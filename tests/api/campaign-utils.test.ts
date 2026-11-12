import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import {
  backfillParticipantWalks,
  CampaignConflictError,
  CampaignNotFoundError,
  CampaignValidationError,
  getActiveCampaignRun,
  getCampaignDetail,
  getCommunityProgress,
  joinCampaignRun,
  listCampaigns,
  type CampaignParticipant,
  type CampaignRun,
  type CampaignRunStatus,
} from '../../src/campaign-utils';
import type { DbClient } from '../../src/db';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const TODAY = '2026-06-10';

const PREREQUISITE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date DATE NOT NULL,
  distance REAL NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(date, user_id)
);
`;

const CAMPAIGN_MIGRATIONS = [
  '0161_create_campaign_definitions.sql',
  '0162_create_campaign_runs.sql',
  '0163_create_campaign_participants.sql',
  '0164_create_campaign_progress_ledger.sql',
];

type SqlValue = string | number | null;

/** Minimal DbClient adapter over an in-memory SQLite database. */
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
 * DbClient whose first participant lookup returns null even though a row
 * exists, simulating a concurrent join that wins the insert race. The `write`
 * side counts `INSERT INTO campaign_participants` attempts so the test can
 * prove the race path (pre-check passed, insert rejected) actually ran instead
 * of falling back to the duplicate pre-check.
 */
function hideFirstParticipantLookup(database: DatabaseSync): {
  db: DbClient;
  insertAttempts: () => number;
} {
  const base = createTestDb(database);
  let hidden = false;
  let insertAttempts = 0;

  const write = {
    prepare(sql: string) {
      const statement = base.write.prepare(sql);
      if (!sql.includes('INSERT INTO campaign_participants')) return statement;

      return {
        bind(...values: unknown[]) {
          insertAttempts += 1;
          return statement.bind(...values);
        },
      } as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;

  return {
    db: {
      read: {
        prepare(sql: string) {
          const statement = base.read.prepare(sql);
          if (
            hidden
            || !sql.includes('FROM campaign_participants')
            || !sql.includes('WHERE run_id = ? AND user_id = ?')
          ) {
            return statement;
          }

          return {
            bind(...values: unknown[]) {
              hidden = true;
              const bound = statement.bind(...values);
              return {
                first: async (): Promise<null> => null,
                all: () => bound.all(),
                run: () => bound.run(),
              };
            },
          } as unknown as D1PreparedStatement;
        },
      } as unknown as D1Database,
      write,
    },
    insertAttempts: () => insertAttempts,
  };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

interface CampaignFixture {
  slug?: string;
  name?: string;
  description?: string;
  imageSlug?: string | null;
  badgeSlug?: string | null;
  enabled?: number;
}

interface RunFixture {
  campaignId: number;
  runNumber?: number;
  target?: number;
  start?: string;
  end?: string;
  status?: CampaignRunStatus;
  completedAt?: string | null;
  participantCount?: number | null;
  contributorCount?: number | null;
  totalDistance?: number | null;
}

describe('campaign domain services', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let campaignSequence = 0;

  function insertUser(username: string): number {
    const result = sqlite
      .prepare('INSERT INTO users (username) VALUES (?)')
      .run(username);
    return Number(result.lastInsertRowid);
  }

  function insertWalk(userId: number, date: string, distance: number): number {
    const result = sqlite
      .prepare('INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)')
      .run(date, distance, userId);
    return Number(result.lastInsertRowid);
  }

  function insertCampaign(fixture: CampaignFixture = {}): number {
    campaignSequence += 1;
    const result = sqlite.prepare(
      `INSERT INTO campaign_definitions (slug, name, description, image_slug, badge_slug, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      fixture.slug ?? `campaign-${campaignSequence}`,
      fixture.name ?? `Campaign ${campaignSequence}`,
      fixture.description ?? 'A community campaign.',
      fixture.imageSlug ?? null,
      fixture.badgeSlug ?? null,
      fixture.enabled ?? 1,
    );
    return Number(result.lastInsertRowid);
  }

  function insertRun(fixture: RunFixture): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_runs
         (campaign_id, run_number, target_distance, start_date, end_date, status,
          completed_at, participant_count, contributor_count, total_distance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      fixture.campaignId,
      fixture.runNumber ?? 1,
      fixture.target ?? 100,
      fixture.start ?? TODAY,
      fixture.end ?? addDays(TODAY, 6),
      fixture.status ?? 'active',
      fixture.completedAt ?? null,
      fixture.participantCount ?? null,
      fixture.contributorCount ?? null,
      fixture.totalDistance ?? null,
    );
    return Number(result.lastInsertRowid);
  }

  function insertParticipant(
    campaignId: number,
    runId: number,
    userId: number,
    progressDistance = 0,
    status: 'active' | 'removed' = 'active',
  ): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_participants
         (campaign_id, run_id, user_id, progress_distance, status, removed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      campaignId,
      runId,
      userId,
      progressDistance,
      status,
      status === 'removed' ? '2026-06-09 12:00:00' : null,
    );
    return Number(result.lastInsertRowid);
  }

  function insertLedger(
    participantId: number,
    runId: number,
    sourceProgressId: number,
    distance: number,
  ): void {
    sqlite.prepare(
      `INSERT INTO campaign_progress_ledger
         (participant_id, run_id, source_progress_id, distance)
       VALUES (?, ?, ?, ?)`,
    ).run(participantId, runId, sourceProgressId, distance);
  }

  function readRun(runId: number): CampaignRun {
    const row = sqlite.prepare(
      `SELECT id, campaign_id, run_number, target_distance, start_date, end_date, status,
              completed_at, announced_at, participant_count, contributor_count,
              total_distance, created_at, updated_at
       FROM campaign_runs WHERE id = ?`,
    ).get(runId) as CampaignRun;
    return row;
  }

  function countRows(table: string): number {
    const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return Number(row.count);
  }

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    for (const filename of CAMPAIGN_MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }
    db = createTestDb(sqlite);
    campaignSequence = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  describe('active run resolution and listing', () => {
    it('lists only enabled campaigns with their active run', async () => {
      const enabledId = insertCampaign({ slug: 'enabled-one', name: 'Enabled One' });
      insertRun({ campaignId: enabledId, target: 250, status: 'active' });
      const disabledId = insertCampaign({ slug: 'disabled-one', enabled: 0 });
      insertRun({ campaignId: disabledId, status: 'active' });

      const campaigns = await listCampaigns(db);

      expect(campaigns.map((campaign) => campaign.slug)).toEqual(['enabled-one']);
      expect(campaigns[0].activeRun).toMatchObject({
        targetDistance: 250,
        startDate: TODAY,
        endDate: addDays(TODAY, 6),
        status: 'active',
        participantCount: 0,
        contributorCount: 0,
        totalDistance: 0,
        fromSnapshot: false,
      });
    });

    it('aggregates live progress through active participants only', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      const walkUser = insertUser('walker');
      const idleUser = insertUser('idle');
      const removedUser = insertUser('removed');

      const walker = insertParticipant(campaignId, runId, walkUser, 12);
      insertLedger(walker, runId, insertWalk(walkUser, TODAY, 12), 12);
      insertParticipant(campaignId, runId, idleUser, 0);
      const removed = insertParticipant(campaignId, runId, removedUser, 50, 'removed');
      insertLedger(removed, runId, insertWalk(removedUser, TODAY, 50), 50);

      const [campaign] = await listCampaigns(db);

      expect(campaign.activeRun).toMatchObject({
        participantCount: 2,
        contributorCount: 1,
        totalDistance: 12,
      });
    });

    it('orders active campaigns before upcoming before history-only campaigns', async () => {
      const activeId = insertCampaign({ slug: 'active', name: 'Active' });
      insertRun({ campaignId: activeId, status: 'active' });
      const upcomingId = insertCampaign({ slug: 'upcoming', name: 'Upcoming' });
      insertRun({
        campaignId: upcomingId,
        status: 'upcoming',
        start: addDays(TODAY, 2),
        end: addDays(TODAY, 9),
      });
      const pastId = insertCampaign({ slug: 'past', name: 'Past' });
      insertRun({
        campaignId: pastId,
        status: 'completed',
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -10),
        completedAt: addDays(TODAY, -9),
        participantCount: 1,
        contributorCount: 1,
        totalDistance: 120,
      });

      const campaigns = await listCampaigns(db);

      expect(campaigns.map((campaign) => campaign.slug)).toEqual([
        'active',
        'upcoming',
        'past',
      ]);
    });

    it('reports past-run outcomes from the final snapshot', async () => {
      const campaignId = insertCampaign();
      insertRun({
        campaignId,
        status: 'completed',
        completedAt: '2026-06-01 09:00:00',
        participantCount: 5,
        contributorCount: 3,
        totalDistance: 400,
      });

      const [campaign] = await listCampaigns(db);

      expect(campaign.activeRun).toBeNull();
      expect(campaign.pastRuns).toHaveLength(1);
      expect(campaign.pastRuns[0]).toMatchObject({
        runNumber: 1,
        status: 'completed',
        participantCount: 5,
        contributorCount: 3,
        totalDistance: 400,
        fromSnapshot: true,
      });
    });

    it('falls back to live aggregates when a terminal run has no snapshot', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId, status: 'expired' });
      const userId = insertUser('walker');
      const participantId = insertParticipant(campaignId, runId, userId, 8);
      insertLedger(participantId, runId, insertWalk(userId, TODAY, 8), 8);

      const [campaign] = await listCampaigns(db);

      expect(campaign.pastRuns[0]).toMatchObject({
        status: 'expired',
        participantCount: 1,
        contributorCount: 1,
        totalDistance: 8,
        fromSnapshot: false,
      });
    });

    it('includes the caller participation only when a userId is supplied', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      const joinedUser = insertUser('joined');
      const otherUser = insertUser('other');
      const participantId = insertParticipant(campaignId, runId, joinedUser, 15);

      expect((await listCampaigns(db))[0].participation).toBeNull();

      const joined = (await listCampaigns(db, { userId: joinedUser }))[0];
      expect(joined.participation).toEqual({
        participantId,
        status: 'active',
        joinedAt: expect.any(String),
        contributionDistance: 15,
      });

      expect((await listCampaigns(db, { userId: otherUser }))[0].participation).toBeNull();
    });

    it('orders campaigns in the same status bucket by start date then name', async () => {
      const zetaId = insertCampaign({ slug: 'zeta', name: 'Zeta' });
      insertRun({
        campaignId: zetaId,
        runNumber: 1,
        status: 'completed',
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -10),
        participantCount: 1,
        contributorCount: 1,
        totalDistance: 80,
      });
      insertRun({
        campaignId: zetaId,
        runNumber: 2,
        status: 'upcoming',
        start: addDays(TODAY, 5),
        end: addDays(TODAY, 12),
      });
      const alphaId = insertCampaign({ slug: 'alpha', name: 'Alpha' });
      insertRun({
        campaignId: alphaId,
        status: 'upcoming',
        start: addDays(TODAY, 2),
        end: addDays(TODAY, 9),
      });
      const betaId = insertCampaign({ slug: 'beta', name: 'Beta' });
      insertRun({
        campaignId: betaId,
        status: 'upcoming',
        start: addDays(TODAY, 2),
        end: addDays(TODAY, 9),
      });

      const campaigns = await listCampaigns(db);

      expect(campaigns.map((campaign) => campaign.slug)).toEqual([
        'alpha',
        'beta',
        'zeta',
      ]);
    });

    it('returns campaign detail with every run newest first', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      insertRun({
        campaignId,
        runNumber: 1,
        status: 'completed',
        participantCount: 2,
        contributorCount: 2,
        totalDistance: 300,
      });
      insertRun({
        campaignId,
        runNumber: 2,
        status: 'expired',
        start: addDays(TODAY, -10),
        end: addDays(TODAY, -5),
        participantCount: 1,
        contributorCount: 1,
        totalDistance: 50,
      });
      insertRun({
        campaignId,
        runNumber: 3,
        status: 'active',
        start: addDays(TODAY, 1),
        end: addDays(TODAY, 5),
      });

      const detail = await getCampaignDetail(db, campaignId);

      expect(detail).not.toBeNull();
      expect(detail?.enabled).toBe(false);
      expect(detail?.runs.map((run) => run.runNumber)).toEqual([3, 2, 1]);
      expect(detail?.activeRun?.runNumber).toBe(3);
      expect(detail?.pastRuns.map((run) => run.runNumber)).toEqual([2, 1]);
    });

    it('resolves a single active run and null when only history remains', async () => {
      const currentId = insertCampaign();
      const runId = insertRun({ campaignId: currentId, status: 'upcoming' });
      expect((await getActiveCampaignRun(db, currentId))?.id).toBe(runId);

      const pastId = insertCampaign();
      insertRun({ campaignId: pastId, status: 'completed' });
      expect(await getActiveCampaignRun(db, pastId)).toBeNull();
    });

    it('returns null detail for an unknown campaign', async () => {
      expect(await getCampaignDetail(db, 9999)).toBeNull();
    });
  });

  describe('per-run participation', () => {
    it('creates an active participant scoped to the active run', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      const userId = insertUser('frodo');

      const result = await joinCampaignRun(db, campaignId, userId, { today: TODAY });

      expect(result.run.id).toBe(runId);
      expect(result.participant).toMatchObject({
        campaign_id: campaignId,
        run_id: runId,
        user_id: userId,
        progress_distance: 0,
        status: 'active',
      });
      expect(result.participant.joined_at).toEqual(expect.any(String));
      expect(countRows('campaign_participants')).toBe(1);
    });

    it('backfills existing walks dated inside the run window', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({
        campaignId,
        start: TODAY,
        end: addDays(TODAY, 6),
      });
      const userId = insertUser('frodo');
      insertWalk(userId, addDays(TODAY, -1), 9);
      insertWalk(userId, TODAY, 5);
      insertWalk(userId, addDays(TODAY, 6), 3);
      insertWalk(userId, addDays(TODAY, 7), 7);

      const result = await joinCampaignRun(db, campaignId, userId, { today: TODAY });

      expect(result.participant.progress_distance).toBe(8);
      expect(countRows('campaign_progress_ledger')).toBe(2);

      const ledger = sqlite.prepare(
        'SELECT distance FROM campaign_progress_ledger ORDER BY distance ASC',
      ).all() as Array<{ distance: number }>;
      expect(ledger.map((row) => row.distance)).toEqual([3, 5]);
    });

    it('keeps the backfill idempotent when a walk is worth re-crediting', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      const userId = insertUser('frodo');
      const walkId = insertWalk(userId, TODAY, 5);

      const joined = await joinCampaignRun(db, campaignId, userId, { today: TODAY });
      expect(joined.participant.progress_distance).toBe(5);

      sqlite.prepare('UPDATE progress SET distance = ? WHERE id = ?').run(8, walkId);
      const participant: CampaignParticipant = joined.participant;
      await backfillParticipantWalks(db, participant, readRun(runId));

      expect(countRows('campaign_progress_ledger')).toBe(1);
      const refreshed = sqlite.prepare(
        'SELECT progress_distance FROM campaign_participants WHERE id = ?',
      ).get(participant.id) as { progress_distance: number };
      expect(refreshed.progress_distance).toBe(8);
    });

    it('rejects a duplicate join of the same run', async () => {
      const campaignId = insertCampaign();
      insertRun({ campaignId });
      const userId = insertUser('frodo');

      await joinCampaignRun(db, campaignId, userId, { today: TODAY });

      await expect(joinCampaignRun(db, campaignId, userId, { today: TODAY }))
        .rejects.toBeInstanceOf(CampaignConflictError);
      expect(countRows('campaign_participants')).toBe(1);
    });

    it('rejects re-joining the current run after removal', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      const userId = insertUser('frodo');
      insertParticipant(campaignId, runId, userId, 4, 'removed');

      await expect(joinCampaignRun(db, campaignId, userId, { today: TODAY }))
        .rejects.toBeInstanceOf(CampaignConflictError);
    });

    it('allows a user from a completed run to join the next run', async () => {
      const campaignId = insertCampaign();
      const runOneId = insertRun({
        campaignId,
        runNumber: 1,
        status: 'completed',
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -10),
      });
      const runTwoId = insertRun({
        campaignId,
        runNumber: 2,
        status: 'upcoming',
        start: addDays(TODAY, 1),
        end: addDays(TODAY, 14),
      });
      const userId = insertUser('frodo');
      insertParticipant(campaignId, runOneId, userId, 42);

      const result = await joinCampaignRun(db, campaignId, userId, { today: TODAY });

      expect(result.participant.run_id).toBe(runTwoId);
      expect(result.participant.progress_distance).toBe(0);

      const runOneParticipant = sqlite.prepare(
        'SELECT progress_distance FROM campaign_participants WHERE run_id = ? AND user_id = ?',
      ).get(runOneId, userId) as { progress_distance: number };
      expect(runOneParticipant.progress_distance).toBe(42);
      expect(countRows('campaign_participants')).toBe(2);
    });

    it('allows a participant removed from a previous run to join the new run', async () => {
      const campaignId = insertCampaign();
      const runOneId = insertRun({
        campaignId,
        runNumber: 1,
        status: 'expired',
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -10),
      });
      const runTwoId = insertRun({
        campaignId,
        runNumber: 2,
        status: 'active',
        start: TODAY,
        end: addDays(TODAY, 6),
      });
      const userId = insertUser('frodo');
      insertParticipant(campaignId, runOneId, userId, 12, 'removed');

      const result = await joinCampaignRun(db, campaignId, userId, { today: TODAY });

      expect(result.participant).toMatchObject({
        run_id: runTwoId,
        status: 'active',
      });

      const runOneParticipant = sqlite.prepare(
        'SELECT status FROM campaign_participants WHERE run_id = ? AND user_id = ?',
      ).get(runOneId, userId) as { status: string };
      expect(runOneParticipant.status).toBe('removed');
    });

    it('rejects joining a run whose end date has passed', async () => {
      const campaignId = insertCampaign();
      insertRun({
        campaignId,
        status: 'active',
        start: addDays(TODAY, -10),
        end: addDays(TODAY, -1),
      });
      const userId = insertUser('frodo');

      await expect(joinCampaignRun(db, campaignId, userId, { today: TODAY }))
        .rejects.toBeInstanceOf(CampaignValidationError);
    });

    it('allows joining an upcoming run', async () => {
      const campaignId = insertCampaign();
      insertRun({
        campaignId,
        status: 'upcoming',
        start: addDays(TODAY, 1),
        end: addDays(TODAY, 14),
      });
      const userId = insertUser('frodo');

      const result = await joinCampaignRun(db, campaignId, userId, { today: TODAY });

      expect(result.participant.status).toBe('active');
    });

    it('rejects joining a disabled campaign', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      insertRun({ campaignId });
      const userId = insertUser('frodo');

      await expect(joinCampaignRun(db, campaignId, userId, { today: TODAY }))
        .rejects.toBeInstanceOf(CampaignValidationError);
    });

    it('hides community progress for a disabled campaign', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      const runId = insertRun({ campaignId });
      const userId = insertUser('frodo');
      const participantId = insertParticipant(campaignId, runId, userId);
      insertLedger(participantId, runId, insertWalk(userId, TODAY, 12), 12);

      await expect(getCommunityProgress(db, campaignId, { today: TODAY }))
        .resolves.toBeNull();
    });

    it('rejects joining a campaign with no current run', async () => {
      const campaignId = insertCampaign();
      insertRun({
        campaignId,
        status: 'completed',
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -10),
      });
      const userId = insertUser('frodo');

      await expect(joinCampaignRun(db, campaignId, userId, { today: TODAY }))
        .rejects.toBeInstanceOf(CampaignValidationError);
    });

    it('rejects joining an unknown campaign', async () => {
      const userId = insertUser('frodo');

      await expect(joinCampaignRun(db, 9999, userId, { today: TODAY }))
        .rejects.toBeInstanceOf(CampaignNotFoundError);
    });

    it('rejects a join that races an existing participant row', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      const userId = insertUser('frodo');
      insertParticipant(campaignId, runId, userId);
      const { db: racingDb, insertAttempts } = hideFirstParticipantLookup(sqlite);

      await expect(joinCampaignRun(racingDb, campaignId, userId, { today: TODAY }))
        .rejects.toBeInstanceOf(CampaignConflictError);
      expect(insertAttempts()).toBe(1);
      expect(countRows('campaign_participants')).toBe(1);
    });

    it('propagates a non-uniqueness insert failure instead of masking it', async () => {
      const campaignId = insertCampaign();
      insertRun({ campaignId });
      const userId = insertUser('frodo');
      const failingDb = createFailingDb(sqlite, 'INSERT INTO campaign_participants');

      await expect(joinCampaignRun(failingDb, campaignId, userId, { today: TODAY }))
        .rejects.toThrow(/injected failure/);
      expect(countRows('campaign_participants')).toBe(0);
    });

    it('still completes the join when the walk backfill fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const campaignId = insertCampaign();
      insertRun({ campaignId });
      const userId = insertUser('frodo');
      insertWalk(userId, TODAY, 5);
      const failingDb = createFailingDb(sqlite, 'FROM progress');

      const result = await joinCampaignRun(failingDb, campaignId, userId, { today: TODAY });

      expect(result.participant.status).toBe('active');
      expect(result.participant.progress_distance).toBe(0);
      expect(countRows('campaign_participants')).toBe(1);
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('community progress', () => {
    it('returns zero progress for a run with no participants', async () => {
      const campaignId = insertCampaign({ slug: 'empty-run' });
      const runId = insertRun({ campaignId, target: 581 });

      const progress = await getCommunityProgress(db, campaignId, { today: TODAY });

      expect(progress).toMatchObject({
        campaignId,
        campaignSlug: 'empty-run',
        runId,
        runNumber: 1,
        targetDistance: 581,
        startDate: TODAY,
        endDate: addDays(TODAY, 6),
        status: 'active',
        daysRemaining: 6,
        totalDistance: 0,
        participantCount: 0,
        contributorCount: 0,
        contributors: [],
        you: null,
      });
    });

    it('counts active participants and contributors and excludes removed ones', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });

      const first = insertUser('first');
      const second = insertUser('second');
      const idle = insertUser('idle');
      const removed = insertUser('removed');

      const firstParticipant = insertParticipant(campaignId, runId, first, 30);
      insertLedger(firstParticipant, runId, insertWalk(first, TODAY, 30), 30);
      const secondParticipant = insertParticipant(campaignId, runId, second, 20);
      insertLedger(secondParticipant, runId, insertWalk(second, TODAY, 20), 20);
      insertParticipant(campaignId, runId, idle, 0);
      const removedParticipant = insertParticipant(campaignId, runId, removed, 50, 'removed');
      insertLedger(removedParticipant, runId, insertWalk(removed, TODAY, 50), 50);

      const progress = await getCommunityProgress(db, campaignId, { today: TODAY });

      expect(progress?.totalDistance).toBe(50);
      expect(progress?.participantCount).toBe(3);
      expect(progress?.contributorCount).toBe(2);
      expect(progress?.contributors.map((entry) => entry.username)).toEqual(['first', 'second']);
    });

    it('uses competition ranking for ties with username as the tie-break', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });

      const distances: Array<[string, number]> = [
        ['cat', 10],
        ['bob', 20],
        ['amy', 20],
        ['dan', 30],
      ];
      for (const [username, distance] of distances) {
        const userId = insertUser(username);
        const participantId = insertParticipant(campaignId, runId, userId, distance);
        insertLedger(participantId, runId, insertWalk(userId, TODAY, distance), distance);
      }

      const progress = await getCommunityProgress(db, campaignId, { today: TODAY });

      expect(progress?.contributors.map((entry) => ({
        username: entry.username,
        rank: entry.rank,
      }))).toEqual([
        { username: 'dan', rank: 1 },
        { username: 'amy', rank: 2 },
        { username: 'bob', rank: 2 },
        { username: 'cat', rank: 4 },
      ]);
    });

    it('adds the caller contribution and rank only when it is positive', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      const contributor = insertUser('contributor');
      const idle = insertUser('idle');

      const contributorParticipant = insertParticipant(campaignId, runId, contributor, 30);
      insertLedger(contributorParticipant, runId, insertWalk(contributor, TODAY, 30), 30);
      insertParticipant(campaignId, runId, idle, 0);

      const publicView = await getCommunityProgress(db, campaignId, { today: TODAY });
      expect(publicView?.you).toBeNull();

      const contributorView = await getCommunityProgress(db, campaignId, {
        today: TODAY,
        userId: contributor,
      });
      expect(contributorView?.you).toEqual({ distance: 30, rank: 1 });

      const idleView = await getCommunityProgress(db, campaignId, {
        today: TODAY,
        userId: idle,
      });
      expect(idleView?.you).toBeNull();
    });

    it('ranks the caller correctly when they fall outside the top 50', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId, target: 5000 });

      let lastUserId = 0;
      for (let index = 1; index <= 55; index += 1) {
        const userId = insertUser(`walker-${String(index).padStart(2, '0')}`);
        const distance = 56 - index;
        const participantId = insertParticipant(campaignId, runId, userId, distance);
        insertLedger(participantId, runId, insertWalk(userId, TODAY, distance), distance);
        lastUserId = userId;
      }

      const progress = await getCommunityProgress(db, campaignId, {
        today: TODAY,
        userId: lastUserId,
      });

      expect(progress?.contributors).toHaveLength(50);
      expect(progress?.contributors[0]).toMatchObject({ distance: 55, rank: 1 });
      expect(progress?.contributors[49]).toMatchObject({ distance: 6, rank: 50 });
      expect(progress?.you).toEqual({ distance: 1, rank: 55 });
    });

    it('returns null for an unknown campaign', async () => {
      expect(await getCommunityProgress(db, 9999, { today: TODAY })).toBeNull();
    });

    it('returns a zeroed payload when the campaign has no current run', async () => {
      const campaignId = insertCampaign({ slug: 'finished' });
      insertRun({
        campaignId,
        status: 'expired',
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -10),
      });

      const progress = await getCommunityProgress(db, campaignId, { today: TODAY });

      expect(progress).toEqual({
        campaignId,
        campaignSlug: 'finished',
        runId: null,
        runNumber: null,
        targetDistance: null,
        startDate: null,
        endDate: null,
        status: null,
        daysRemaining: null,
        totalDistance: 0,
        participantCount: 0,
        contributorCount: 0,
        contributors: [],
        you: null,
      });
    });
  });
});
