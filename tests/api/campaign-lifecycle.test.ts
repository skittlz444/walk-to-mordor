import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../src/campaign-utils', () => ({
  ...jest.requireActual('../../src/campaign-utils'),
  runCampaignLifecycleTransitions: jest.fn(),
}));

jest.mock('../../src/scheduled-handlers', () => ({
  handleOneMoreMileCron: jest.fn(),
  handleReengagementCron: jest.fn(),
}));

jest.mock('../../src/event-utils', () => ({
  ...jest.requireActual('../../src/event-utils'),
  settleExpiredChallenges: jest.fn(),
}));

import {
  runCampaignLifecycleTransitions,
} from '../../src/campaign-utils';
import { settleExpiredChallenges } from '../../src/event-utils';
import { handleOneMoreMileCron, handleReengagementCron } from '../../src/scheduled-handlers';
import worker from '../../src/index';
import type { DbClient } from '../../src/db';

const actualCampaignUtils = jest.requireActual<typeof import('../../src/campaign-utils')>(
  '../../src/campaign-utils',
);

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

/** DbClient that fails once on the first statement containing `fragment`. */
function createOneShotFailingDb(database: DatabaseSync, fragment: string): DbClient {
  const base = createTestDb(database);
  let tripped = false;
  const wrap = (d1: D1Database): D1Database => ({
    prepare(sql: string) {
      if (!tripped && sql.includes(fragment)) {
        tripped = true;
        throw new Error(`injected failure for ${fragment}`);
      }
      return d1.prepare(sql);
    },
  } as unknown as D1Database);

  return { read: wrap(base.read), write: wrap(base.write) };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

interface RunFixture {
  campaignId: number;
  runNumber?: number;
  target?: number;
  start?: string;
  end?: string;
  status?: string;
}

interface RunSnapshot {
  id: number;
  status: string;
  participant_count: number | null;
  contributor_count: number | null;
  total_distance: number | null;
}

describe('campaign run lifecycle transitions', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let campaignSequence = 0;

  function insertCampaign(enabled: number): number {
    campaignSequence += 1;
    const result = sqlite.prepare(
      `INSERT INTO campaign_definitions (slug, name, description, enabled)
       VALUES (?, ?, 'A community campaign.', ?)`,
    ).run(`campaign-${campaignSequence}`, `Campaign ${campaignSequence}`, enabled);
    return Number(result.lastInsertRowid);
  }

  function insertRun(fixture: RunFixture): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_runs
         (campaign_id, run_number, target_distance, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      fixture.campaignId,
      fixture.runNumber ?? 1,
      fixture.target ?? 100,
      fixture.start ?? TODAY,
      fixture.end ?? addDays(TODAY, 6),
      fixture.status ?? 'upcoming',
    );
    return Number(result.lastInsertRowid);
  }

  function insertContributor(runId: number, campaignId: number, distance: number): void {
    const user = sqlite.prepare('INSERT INTO users (username) VALUES (?)').run('walker');
    const userId = Number(user.lastInsertRowid);
    const participant = sqlite.prepare(
      `INSERT INTO campaign_participants
         (campaign_id, run_id, user_id, progress_distance)
       VALUES (?, ?, ?, ?)`,
    ).run(campaignId, runId, userId, distance);
    const walk = sqlite.prepare(
      'INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)',
    ).run(TODAY, distance, userId);
    sqlite.prepare(
      `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
       VALUES (?, ?, ?, ?)`,
    ).run(Number(participant.lastInsertRowid), runId, Number(walk.lastInsertRowid), distance);
  }

  function readRun(runId: number): RunSnapshot {
    return sqlite.prepare(
      `SELECT id, status, participant_count, contributor_count, total_distance
       FROM campaign_runs WHERE id = ?`,
    ).get(runId) as RunSnapshot;
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

  it('activates an upcoming run on its start date without creating runs', async () => {
    const campaignId = insertCampaign(1);
    const runId = insertRun({ campaignId, start: TODAY, end: addDays(TODAY, 6) });
    const countBefore = (sqlite.prepare(
      'SELECT COUNT(*) AS count FROM campaign_runs',
    ).get() as { count: number }).count;

    const result = await actualCampaignUtils.runCampaignLifecycleTransitions(db, { today: TODAY });

    expect(result).toEqual({ activated: 1, expired: 0, failed: 0 });
    expect(readRun(runId).status).toBe('active');
    const countAfter = (sqlite.prepare(
      'SELECT COUNT(*) AS count FROM campaign_runs',
    ).get() as { count: number }).count;
    expect(countAfter).toBe(countBefore);
  });

  it('leaves a future upcoming run alone', async () => {
    const campaignId = insertCampaign(1);
    const runId = insertRun({
      campaignId,
      start: addDays(TODAY, 1),
      end: addDays(TODAY, 7),
    });

    const result = await actualCampaignUtils.runCampaignLifecycleTransitions(db, { today: TODAY });

    expect(result.activated).toBe(0);
    expect(readRun(runId).status).toBe('upcoming');
  });

  it('expires an active run past its end date when the target is unmet', async () => {
    const campaignId = insertCampaign(1);
    const runId = insertRun({
      campaignId,
      target: 100,
      start: addDays(TODAY, -10),
      end: addDays(TODAY, -1),
      status: 'active',
    });
    insertContributor(runId, campaignId, 30);

    const result = await actualCampaignUtils.runCampaignLifecycleTransitions(db, { today: TODAY });

    expect(result).toEqual({ activated: 0, expired: 1, failed: 0 });
    expect(readRun(runId)).toMatchObject({
      status: 'expired',
      participant_count: 1,
      contributor_count: 1,
      total_distance: 30,
    });
  });

  it('does not expire a past-deadline run whose target was met', async () => {
    const campaignId = insertCampaign(1);
    const runId = insertRun({
      campaignId,
      target: 20,
      start: addDays(TODAY, -10),
      end: addDays(TODAY, -1),
      status: 'active',
    });
    insertContributor(runId, campaignId, 30);

    const result = await actualCampaignUtils.runCampaignLifecycleTransitions(db, { today: TODAY });

    expect(result.expired).toBe(0);
    expect(readRun(runId)).toMatchObject({
      status: 'active',
      participant_count: null,
      contributor_count: null,
      total_distance: null,
    });
  });

  it('does not expire a run on its end date', async () => {
    const campaignId = insertCampaign(1);
    const runId = insertRun({
      campaignId,
      start: addDays(TODAY, -6),
      end: TODAY,
      status: 'active',
    });

    await actualCampaignUtils.runCampaignLifecycleTransitions(db, { today: TODAY });

    expect(readRun(runId).status).toBe('active');
  });

  it('skips disabled campaigns for both transitions', async () => {
    const disabledUpcomingCampaignId = insertCampaign(0);
    const upcomingRunId = insertRun({ campaignId: disabledUpcomingCampaignId, start: TODAY });
    const disabledActiveCampaignId = insertCampaign(0);
    const expiringRunId = insertRun({
      campaignId: disabledActiveCampaignId,
      start: addDays(TODAY, -10),
      end: addDays(TODAY, -1),
      status: 'active',
    });

    const result = await actualCampaignUtils.runCampaignLifecycleTransitions(db, { today: TODAY });

    expect(result).toEqual({ activated: 0, expired: 0, failed: 0 });
    expect(readRun(upcomingRunId).status).toBe('upcoming');
    expect(readRun(expiringRunId).status).toBe('active');
  });

  it('isolates one broken run so the rest still transition', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const campaignId = insertCampaign(1);
    const brokenRunId = insertRun({
      campaignId,
      start: addDays(TODAY, -10),
      end: addDays(TODAY, -1),
      status: 'active',
    });
    const healthyRunId = insertRun({
      campaignId: insertCampaign(1),
      start: addDays(TODAY, -10),
      end: addDays(TODAY, -1),
      status: 'active',
    });
    const failingDb = createOneShotFailingDb(sqlite, "SET status = 'expired'");

    const result = await actualCampaignUtils.runCampaignLifecycleTransitions(failingDb, {
      today: TODAY,
    });

    expect(result.expired).toBe(1);
    expect(result.failed).toBe(1);
    expect(readRun(brokenRunId).status).toBe('active');
    expect(readRun(healthyRunId).status).toBe('expired');
    expect(consoleError).toHaveBeenCalledWith(
      'Error expiring campaign run:',
      expect.anything(),
    );
  });

  describe('scheduled() wiring', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.mocked(handleOneMoreMileCron).mockResolvedValue(undefined);
      jest.mocked(handleReengagementCron).mockResolvedValue(undefined);
      jest.mocked(settleExpiredChallenges).mockResolvedValue({ completed: 0, failed: 0 });
      jest.mocked(runCampaignLifecycleTransitions).mockResolvedValue({
        activated: 0,
        expired: 0,
        failed: 0,
      });
    });

    it('runs the lifecycle pass after the existing jobs', async () => {
      const env = { DB: {} } as unknown as Env;

      await worker.scheduled({} as never, env, {} as never);

      expect(handleOneMoreMileCron).toHaveBeenCalledWith(env);
      expect(handleReengagementCron).toHaveBeenCalledWith(env);
      expect(settleExpiredChallenges).toHaveBeenCalledTimes(1);
      expect(runCampaignLifecycleTransitions).toHaveBeenCalledTimes(1);
    });

    it('still runs the existing jobs when the lifecycle pass throws', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.mocked(runCampaignLifecycleTransitions).mockRejectedValue(new Error('lifecycle boom'));
      const env = { DB: {} } as unknown as Env;

      await worker.scheduled({} as never, env, {} as never);

      expect(handleOneMoreMileCron).toHaveBeenCalledWith(env);
      expect(handleReengagementCron).toHaveBeenCalledWith(env);
      expect(settleExpiredChallenges).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        'Scheduled campaign lifecycle transition failed',
        expect.any(Error),
      );
    });
  });
});
