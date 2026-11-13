import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import {
  handleProgressDelete,
  handleProgressPost,
  handleProgressPut,
} from '../../src/progress-handlers';
import type { DbClient } from '../../src/db';
import { joinCampaignRun } from '../../src/campaign-utils';
import { addDays, utcToday } from '../../src/event-utils';

jest.mock('../../src/achievement-awards', () => ({
  checkAndAwardJourneyBadges: jest.fn().mockResolvedValue(undefined),
}));

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const TODAY = utcToday();
const AUTH_HEADER = 'Bearer TEST_MOCK_TOKEN_frodo';
const BADGE_SLUG = 'community-beacon-watch';

const PREREQUISITE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  approved INTEGER DEFAULT 1,
  reengage_tier_sent INTEGER DEFAULT 0
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date DATE NOT NULL,
  distance REAL NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(date, user_id)
);

CREATE TABLE party_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  party_id INTEGER,
  user_id INTEGER,
  status TEXT
);
`;

const CAMPAIGN_MIGRATIONS = [
  '0142_create_achievement_definitions.sql',
  '0143_create_user_achievement_instances.sql',
  '0161_create_campaign_definitions.sql',
  '0162_create_campaign_runs.sql',
  '0163_create_campaign_participants.sql',
  '0164_create_campaign_progress_ledger.sql',
];

type SqlValue = string | number | null;

function createTestDb(database: DatabaseSync): DbClient {
  const connection = {
    prepare(sql: string) {
      const statement = () => database.prepare(sql);
      const bound = (values: SqlValue[]) => ({
        async first<T>(): Promise<T | null> {
          return (statement().get(...values) ?? null) as T | null;
        },
        async all<T>() {
          return { results: statement().all(...values) as T[] };
        },
        async run() {
          const result = statement().run(...values);
          return {
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
      });

      return {
        ...bound([]),
        bind(...values: SqlValue[]) {
          return bound(values);
        },
      };
    },
  };

  return {
    read: connection as unknown as D1Database,
    write: connection as unknown as D1Database,
  };
}

/** DbClient whose prepare() throws for SQL containing `fragment`. */
function createFailingDb(database: DatabaseSync, fragment: string): DbClient {
  const base = createTestDb(database);
  const wrap = (d1: D1Database): D1Database => ({
    prepare(sql: string) {
      if (sql.includes(fragment)) {
        throw new Error(`injected failure for ${fragment}`);
      }
      return d1.prepare(sql);
    },
  } as unknown as D1Database);

  return { read: wrap(base.read), write: wrap(base.write) };
}

/**
 * DbClient whose badge insert throws for one user only, so a completion award
 * failure stays isolated to that contributor.
 */
function createBadgeFailureDb(database: DatabaseSync, failingUserId: number): DbClient {
  const base = createTestDb(database);
  const wrap = (d1: D1Database): D1Database => ({
    prepare(sql: string) {
      const statement = d1.prepare(sql);
      if (!sql.includes('INSERT INTO user_achievement_instances')) return statement;

      return {
        bind(...values: SqlValue[]) {
          const bound = statement.bind(...values);
          if (values[0] !== failingUserId) return bound;
          return {
            first: () => bound.first(),
            all: () => bound.all(),
            async run() {
              throw new Error('injected badge failure');
            },
          };
        },
      } as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database);

  return { read: wrap(base.read), write: wrap(base.write) };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

interface RunRow {
  id: number;
  status: string;
  completed_at: string | null;
  participant_count: number | null;
  contributor_count: number | null;
  total_distance: number | null;
}

describe('walk saves → community campaign reconciliation', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let userId: number;
  let otherUserId: number;
  let campaignId: number;

  function request(method: 'POST' | 'PUT' | 'DELETE'): Request {
    return new Request('http://localhost/api/calendar-progress', {
      method,
      headers: { Authorization: AUTH_HEADER },
    });
  }

  function insertUser(username: string): number {
    const result = sqlite.prepare(
      "INSERT INTO users (username, email, approved) VALUES (?, ?, 1)",
    ).run(username, `${username}@example.com`);
    return Number(result.lastInsertRowid);
  }

  function insertCampaign(
    enabled: number,
    slug = 'beacon-watch',
    badgeSlug: string | null = BADGE_SLUG,
  ): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_definitions (slug, name, description, enabled, badge_slug)
       VALUES (?, 'Beacon Watch', 'A community campaign.', ?, ?)`,
    ).run(slug, enabled, badgeSlug);
    return Number(result.lastInsertRowid);
  }

  function insertRun(options: {
    campaign?: number;
    runNumber?: number;
    target?: number;
    start?: string;
    end?: string;
    status?: string;
  } = {}): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_runs
         (campaign_id, run_number, target_distance, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      options.campaign ?? campaignId,
      options.runNumber ?? 1,
      options.target ?? 100,
      options.start ?? TODAY,
      options.end ?? addDays(TODAY, 6),
      options.status ?? 'active',
    );
    return Number(result.lastInsertRowid);
  }

  function insertParticipant(
    runId: number,
    participantUserId: number,
    progressDistance = 0,
    status: 'active' | 'removed' = 'active',
  ): number {
    const run = sqlite.prepare(
      'SELECT campaign_id FROM campaign_runs WHERE id = ?',
    ).get(runId) as { campaign_id: number };
    const result = sqlite.prepare(
      `INSERT INTO campaign_participants
         (campaign_id, run_id, user_id, progress_distance, status)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(run.campaign_id, runId, participantUserId, progressDistance, status);
    return Number(result.lastInsertRowid);
  }

  function insertWalk(walkUserId: number, date: string, distance: number): number {
    const result = sqlite.prepare(
      'INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)',
    ).run(date, distance, walkUserId);
    return Number(result.lastInsertRowid);
  }

  function insertLedger(participantId: number, runId: number, sourceId: number, distance: number): void {
    sqlite.prepare(
      `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
       VALUES (?, ?, ?, ?)`,
    ).run(participantId, runId, sourceId, distance);
  }

  function readRun(runId: number): RunRow {
    return sqlite.prepare(
      `SELECT id, status, completed_at, participant_count, contributor_count, total_distance
       FROM campaign_runs WHERE id = ?`,
    ).get(runId) as RunRow;
  }

  function readParticipantDistance(participantId: number): number {
    const row = sqlite.prepare(
      'SELECT progress_distance FROM campaign_participants WHERE id = ?',
    ).get(participantId) as { progress_distance: number };
    return row.progress_distance;
  }

  function ledgerRows(participantId: number): Array<{ distance: number; source_progress_id: number }> {
    return sqlite.prepare(
      `SELECT distance, source_progress_id FROM campaign_progress_ledger
       WHERE participant_id = ? ORDER BY id ASC`,
    ).all(participantId) as Array<{ distance: number; source_progress_id: number }>;
  }

  function participantRows(runId: number): Array<{
    id: number;
    user_id: number;
    progress_distance: number;
    status: string;
  }> {
    return sqlite.prepare(
      `SELECT id, user_id, progress_distance, status
       FROM campaign_participants WHERE run_id = ? ORDER BY id ASC`,
    ).all(runId) as Array<{
      id: number;
      user_id: number;
      progress_distance: number;
      status: string;
    }>;
  }

  function ledgerRowsForRun(runId: number): Array<{
    id: number;
    participant_id: number;
    source_progress_id: number;
    distance: number;
  }> {
    return sqlite.prepare(
      `SELECT id, participant_id, source_progress_id, distance
       FROM campaign_progress_ledger WHERE run_id = ? ORDER BY id ASC`,
    ).all(runId) as Array<{
      id: number;
      participant_id: number;
      source_progress_id: number;
      distance: number;
    }>;
  }

  function badgeRows(achievementUserId: number): Array<{ idempotency_key: string }> {
    return sqlite.prepare(
      `SELECT uai.idempotency_key
       FROM user_achievement_instances uai
       JOIN achievement_definitions ad ON ad.id = uai.achievement_id
       WHERE uai.user_id = ? AND ad.slug = ?
       ORDER BY uai.id ASC`,
    ).all(achievementUserId, BADGE_SLUG) as Array<{ idempotency_key: string }>;
  }

  async function createWalk(date: string, distance: number): Promise<Response> {
    return handleProgressPost(request('POST'), db, { start: date, title: distance }, 'true');
  }

  async function updateWalk(date: string, distance: number): Promise<Response> {
    return handleProgressPut(request('PUT'), db, { start: date, title: distance }, 'true');
  }

  async function deleteWalk(date: string): Promise<Response> {
    return handleProgressDelete(request('DELETE'), db, { start: date }, 'true');
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    for (const filename of CAMPAIGN_MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }

    sqlite.prepare(
      `INSERT INTO achievement_definitions
         (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
       VALUES (?, 'Beacon Warden', 'Complete a Beacon Watch run.', ?, 'community', 1,
               '{"rank_thresholds":[1,3,7,15]}')`,
    ).run(BADGE_SLUG, BADGE_SLUG);

    userId = insertUser('frodo');
    otherUserId = insertUser('sam');
    campaignId = insertCampaign(1);
    db = createTestDb(sqlite);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('credits a walk dated inside the active run window', async () => {
    const runId = insertRun();
    const participantId = insertParticipant(runId, userId);

    const response = await createWalk(addDays(TODAY, 2), 7);

    expect(response.status).toBe(201);
    expect(ledgerRows(participantId)).toEqual([
      { distance: 7, source_progress_id: expect.any(Number) },
    ]);
    expect(readParticipantDistance(participantId)).toBe(7);
  });

  it('does not credit a walk created or edited outside the active run window', async () => {
    const runId = insertRun({ start: TODAY, end: addDays(TODAY, 6) });
    const participantId = insertParticipant(runId, userId);
    const outsideDate = addDays(TODAY, -1);

    const createResponse = await createWalk(outsideDate, 7);
    const updateResponse = await updateWalk(outsideDate, 9);

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(ledgerRows(participantId)).toEqual([]);
    expect(readParticipantDistance(participantId)).toBe(0);
  });

  it.each([
    ['upcoming', addDays(TODAY, 1), addDays(TODAY, 8), addDays(TODAY, 1)],
    ['completed', addDays(TODAY, -2), addDays(TODAY, 2), TODAY],
    ['expired', addDays(TODAY, -2), addDays(TODAY, 2), TODAY],
  ])(
    'does not credit or complete a %s run even for an in-window walk date',
    async (status, start, end, walkDate) => {
      const runId = insertRun({ status, start, end });
      const participantId = insertParticipant(runId, userId);

      const response = await createWalk(walkDate, 500);

      expect(response.status).toBe(201);
      expect(ledgerRows(participantId)).toEqual([]);
      expect(readRun(runId).status).toBe(status);
    },
  );

  it('skips disabled campaigns, removed participants, and disabled-campaign runs', async () => {
    const disabledCampaignId = insertCampaign(0, 'disabled-campaign');
    const disabledRunId = insertRun({ campaign: disabledCampaignId });
    const disabledParticipant = insertParticipant(disabledRunId, userId);

    const activeRunId = insertRun({ campaign: campaignId, runNumber: 2 });
    const removedParticipant = insertParticipant(activeRunId, userId, 4, 'removed');

    await createWalk(TODAY, 12);

    expect(ledgerRows(disabledParticipant)).toEqual([]);
    expect(ledgerRows(removedParticipant)).toEqual([]);
  });

  it('updates the ledger row in place when a walk distance is edited', async () => {
    const runId = insertRun();
    const participantId = insertParticipant(runId, userId);

    await createWalk(TODAY, 5);
    const response = await updateWalk(TODAY, 8);

    expect(response.status).toBe(200);
    expect(ledgerRows(participantId)).toHaveLength(1);
    expect(ledgerRows(participantId)[0].distance).toBe(8);
    expect(readParticipantDistance(participantId)).toBe(8);
  });

  it('keeps one ledger row when an edit does not change the distance', async () => {
    const runId = insertRun();
    const participantId = insertParticipant(runId, userId);

    await createWalk(TODAY, 5);
    await updateWalk(TODAY, 5);

    expect(ledgerRows(participantId)).toHaveLength(1);
    expect(readParticipantDistance(participantId)).toBe(5);
  });

  it('removes the walk ledger row on delete and recomputes the cached total', async () => {
    const runId = insertRun();
    const participantId = insertParticipant(runId, userId);
    await createWalk(addDays(TODAY, 1), 6);

    const response = await deleteWalk(addDays(TODAY, 1));

    expect(response.status).toBe(200);
    expect(ledgerRows(participantId)).toEqual([]);
    expect(readParticipantDistance(participantId)).toBe(0);
  });

  it('completes the run, writes the snapshot once, and awards every contributor', async () => {
    const runId = insertRun({ target: 100 });
    const participantId = insertParticipant(runId, userId);

    const otherParticipant = insertParticipant(runId, otherUserId, 95);
    insertLedger(otherParticipant, runId, insertWalk(otherUserId, addDays(TODAY, -1), 95), 95);
    const idleUserId = insertUser('idle');
    insertParticipant(runId, idleUserId);

    await createWalk(TODAY, 6);

    expect(readParticipantDistance(participantId)).toBe(6);
    expect(readRun(runId)).toMatchObject({
      status: 'completed',
      participant_count: 3,
      contributor_count: 2,
      total_distance: 101,
    });
    expect(readRun(runId).completed_at).toEqual(expect.any(String));

    expect(badgeRows(userId).map((row) => row.idempotency_key)).toEqual([
      `campaign:beacon-watch:run:${runId}`,
    ]);
    expect(badgeRows(otherUserId).map((row) => row.idempotency_key)).toEqual([
      `campaign:beacon-watch:run:${runId}`,
    ]);
    expect(badgeRows(idleUserId)).toEqual([]);
  });

  it('does not credit or re-complete a run after it completes', async () => {
    const runId = insertRun({ target: 10 });
    insertParticipant(runId, userId);

    await createWalk(TODAY, 10);
    expect(readRun(runId).status).toBe('completed');
    const snapshot = readRun(runId);

    await createWalk(addDays(TODAY, 1), 50);

    expect(readRun(runId)).toEqual(snapshot);
  });

  it('awards a second badge instance under a later run key', async () => {
    const runOneId = insertRun({ target: 10, runNumber: 1 });
    insertParticipant(runOneId, userId);
    await createWalk(TODAY, 10);
    expect(readRun(runOneId).status).toBe('completed');
    const runOneParticipants = participantRows(runOneId);
    const runOneLedger = ledgerRowsForRun(runOneId);

    const runTwoId = insertRun({
      target: 10,
      runNumber: 2,
      start: addDays(TODAY, 1),
      end: addDays(TODAY, 7),
    });
    insertParticipant(runTwoId, userId);

    await createWalk(addDays(TODAY, 1), 10);

    expect(readRun(runTwoId).status).toBe('completed');
    expect(badgeRows(userId).map((row) => row.idempotency_key)).toEqual([
      `campaign:beacon-watch:run:${runOneId}`,
      `campaign:beacon-watch:run:${runTwoId}`,
    ]);
    // Retriggering never rewrites the previous run's history.
    expect(participantRows(runOneId)).toEqual(runOneParticipants);
    expect(ledgerRowsForRun(runOneId)).toEqual(runOneLedger);
  });

  it('completes a run when join-time backfill pushes the total past target', async () => {
    const runId = insertRun({ target: 100 });
    const otherParticipant = insertParticipant(runId, otherUserId, 99);
    insertLedger(otherParticipant, runId, insertWalk(otherUserId, addDays(TODAY, -1), 99), 99);
    insertWalk(userId, TODAY, 5);

    const joined = await joinCampaignRun(db, campaignId, userId, { today: TODAY });

    expect(joined.participant.progress_distance).toBe(5);
    expect(readRun(runId)).toMatchObject({
      status: 'completed',
      participant_count: 2,
      contributor_count: 2,
      total_distance: 104,
    });
    const idempotencyKey = `campaign:beacon-watch:run:${runId}`;
    expect(badgeRows(userId).map((row) => row.idempotency_key)).toEqual([idempotencyKey]);
    expect(badgeRows(otherUserId).map((row) => row.idempotency_key)).toEqual([idempotencyKey]);
  });

  it('completes a run whose target was already met when a user joins', async () => {
    const runId = insertRun({ target: 100 });
    const otherParticipant = insertParticipant(runId, otherUserId, 100);
    insertLedger(otherParticipant, runId, insertWalk(otherUserId, addDays(TODAY, -1), 100), 100);

    const joined = await joinCampaignRun(db, campaignId, userId, { today: TODAY });

    expect(joined.participant.progress_distance).toBe(0);
    expect(readRun(runId)).toMatchObject({
      status: 'completed',
      participant_count: 2,
      contributor_count: 1,
      total_distance: 100,
    });
    expect(badgeRows(otherUserId).map((row) => row.idempotency_key)).toEqual([
      `campaign:beacon-watch:run:${runId}`,
    ]);
    expect(badgeRows(userId)).toEqual([]);
  });

  it('does not complete an over-target upcoming run when a user joins', async () => {
    const runId = insertRun({
      target: 10,
      status: 'upcoming',
      start: addDays(TODAY, 1),
      end: addDays(TODAY, 7),
    });
    const preCreditedParticipant = insertParticipant(runId, otherUserId, 20);
    insertLedger(
      preCreditedParticipant,
      runId,
      insertWalk(otherUserId, addDays(TODAY, 1), 20),
      20,
    );

    await joinCampaignRun(db, campaignId, userId, { today: TODAY });

    expect(readRun(runId)).toMatchObject({
      status: 'upcoming',
      completed_at: null,
      participant_count: null,
      contributor_count: null,
      total_distance: null,
    });
    expect(badgeRows(otherUserId)).toEqual([]);
  });

  it('isolates a badge-award failure to one contributor', async () => {
    const consoleError = jest.spyOn(console, 'error');
    const runId = insertRun({ target: 10 });
    const firstParticipant = insertParticipant(runId, userId, 5);
    insertLedger(firstParticipant, runId, insertWalk(userId, addDays(TODAY, -1), 5), 5);
    const secondParticipant = insertParticipant(runId, otherUserId, 5);
    insertLedger(secondParticipant, runId, insertWalk(otherUserId, addDays(TODAY, -2), 5), 5);
    const failingDb = createBadgeFailureDb(sqlite, userId);

    const response = await handleProgressPost(
      request('POST'),
      failingDb,
      { start: TODAY, title: 5 },
      'true',
    );

    expect(response.status).toBe(201);
    expect(readRun(runId)).toMatchObject({
      status: 'completed',
      total_distance: 15,
    });
    expect(badgeRows(userId)).toEqual([]);
    expect(badgeRows(otherUserId).map((row) => row.idempotency_key)).toEqual([
      `campaign:beacon-watch:run:${runId}`,
    ]);
    expect(consoleError).toHaveBeenCalledWith(
      'Error awarding campaign completion badge:',
      expect.anything(),
    );
  });

  it('never blocks the walk save when campaign reconciliation fails', async () => {
    const consoleError = jest.spyOn(console, 'error');
    const runId = insertRun();
    insertParticipant(runId, userId);
    const failingDb = createFailingDb(sqlite, 'campaign_progress_ledger');

    const response = await handleProgressPost(
      request('POST'),
      failingDb,
      { start: TODAY, title: 9 },
      'true',
    );

    expect(response.status).toBe(201);
    const progressRow = sqlite.prepare(
      'SELECT distance FROM progress WHERE user_id = ? AND date = ?',
    ).get(userId, TODAY) as { distance: number };
    expect(progressRow.distance).toBe(9);
    expect(consoleError).toHaveBeenCalledWith(
      'Error reconciling campaign progress:',
      expect.anything(),
    );
  });
});
