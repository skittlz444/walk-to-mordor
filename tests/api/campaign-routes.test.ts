import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import { app } from '../../src/index';
import type { DbClient } from '../../src/db';
import { addDays, utcToday } from '../../src/event-utils';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const TODAY = utcToday();
const AUTH_HEADER = 'Bearer TEST_MOCK_TOKEN_frodo';

const PREREQUISITE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  approved INTEGER DEFAULT 1
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

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
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

interface JsonBody {
  campaigns?: Array<Record<string, unknown>>;
  activeRun?: Record<string, unknown> | null;
  participation?: Record<string, unknown> | null;
  runs?: Array<Record<string, unknown>>;
  contributors?: Array<Record<string, unknown>>;
  you?: Record<string, unknown> | null;
  totalDistance?: number;
  participantCount?: number;
  contributorCount?: number;
  error?: string;
  joined?: boolean;
  runId?: number;
  [key: string]: unknown;
}

describe('community campaign routes', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let env: Env;
  let userId: number;

  function authed(init: RequestInit = {}): RequestInit {
    return {
      ...init,
      headers: { Authorization: AUTH_HEADER },
    };
  }

  function insertCampaign(options: {
    slug?: string;
    name?: string;
    enabled?: number;
  } = {}): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_definitions (slug, name, description, image_slug, badge_slug, enabled)
       VALUES (?, ?, 'A community campaign.', ?, ?, ?)`,
    ).run(
      options.slug ?? 'beacon-watch',
      options.name ?? 'Beacon Watch',
      options.slug ?? 'beacon-watch',
      'community-beacon-watch',
      options.enabled ?? 1,
    );
    return Number(result.lastInsertRowid);
  }

  function insertRun(options: {
    campaignId: number;
    runNumber?: number;
    target?: number;
    start?: string;
    end?: string;
    status?: string;
  }): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_runs
         (campaign_id, run_number, target_distance, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      options.campaignId,
      options.runNumber ?? 1,
      options.target ?? 100,
      options.start ?? TODAY,
      options.end ?? addDays(TODAY, 6),
      options.status ?? 'active',
    );
    return Number(result.lastInsertRowid);
  }

  function insertWalk(date: string, distance: number): number {
    const result = sqlite.prepare(
      'INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)',
    ).run(date, distance, userId);
    return Number(result.lastInsertRowid);
  }

  function insertParticipant(
    campaignId: number,
    runId: number,
    distance: number,
    status: 'active' | 'removed' = 'active',
  ): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_participants
         (campaign_id, run_id, user_id, progress_distance, status)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(campaignId, runId, userId, distance, status);
    return Number(result.lastInsertRowid);
  }

  function insertLedgerEntry(
    participantId: number,
    runId: number,
    distance: number,
  ): void {
    const walk = insertWalk(TODAY, distance);
    sqlite.prepare(
      `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
       VALUES (?, ?, ?, ?)`,
    ).run(participantId, runId, walk, distance);
  }

  async function getJson(pathname: string, init?: RequestInit): Promise<{ status: number; body: JsonBody }> {
    const response = await app.request(pathname, init, env);
    return { status: response.status, body: (await response.json()) as JsonBody };
  }

  function envFor(client: DbClient): Env {
    return {
      DB: client.read,
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      ALLOW_TEST_AUTH: 'true',
    } as unknown as Env;
  }

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    for (const filename of CAMPAIGN_MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }

    const user = sqlite.prepare(
      "INSERT INTO users (username, email, approved) VALUES ('frodo', 'frodo@example.com', 1)",
    ).run();
    userId = Number(user.lastInsertRowid);

    db = createTestDb(sqlite);
    env = envFor(db);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  describe('GET /api/events', () => {
    it('serves enabled campaigns publicly without a personal overlay', async () => {
      const enabledId = insertCampaign({ slug: 'enabled' });
      insertRun({ campaignId: enabledId, target: 581 });
      const disabledId = insertCampaign({ slug: 'disabled', enabled: 0 });
      insertRun({ campaignId: disabledId });

      const { status, body } = await getJson('/api/events');

      expect(status).toBe(200);
      expect(body.campaigns).toHaveLength(1);
      expect(body.campaigns?.[0]).toMatchObject({
        slug: 'enabled',
        name: 'Beacon Watch',
        imageSlug: 'enabled',
        enabled: true,
        participation: null,
        activeRun: {
          targetDistance: 581,
          startDate: TODAY,
          endDate: addDays(TODAY, 6),
          status: 'active',
        },
      });
    });

    it('adds participation and contribution for a valid auth header', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      insertParticipant(campaignId, runId, 12);

      const { status, body } = await getJson('/api/events', authed());

      expect(status).toBe(200);
      expect(body.campaigns?.[0].participation).toMatchObject({
        status: 'active',
        contributionDistance: 12,
      });
    });

    it('treats an invalid auth header as anonymous', async () => {
      insertCampaign();

      const { status, body } = await getJson('/api/events', {
        headers: { Authorization: 'Bearer not-a-real-session' },
      });

      expect(status).toBe(200);
      expect(body.campaigns?.[0].participation).toBeNull();
    });

    it('returns 500 when the campaign query fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const response = await app.request(
        '/api/events',
        undefined,
        envFor(createFailingDb(sqlite, 'FROM campaign_definitions')),
      );

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/events/:id', () => {
    it('serves campaign detail with run history publicly', async () => {
      const campaignId = insertCampaign();
      insertRun({
        campaignId,
        runNumber: 1,
        status: 'completed',
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -10),
        target: 90,
      });
      insertRun({ campaignId, runNumber: 2, status: 'active' });

      const { status, body } = await getJson(`/api/events/${campaignId}`);

      expect(status).toBe(200);
      expect(body.slug).toBe('beacon-watch');
      expect(body.participation).toBeNull();
      expect(body.runs?.map((run) => run.runNumber)).toEqual([2, 1]);
      expect(body.pastRuns).toHaveLength(1);
    });

    it('adds participation for a valid auth header', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      insertParticipant(campaignId, runId, 4);

      const { body } = await getJson(`/api/events/${campaignId}`, authed());

      expect(body.participation).toMatchObject({ contributionDistance: 4 });
    });

    it('returns 404 for a disabled campaign', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      insertRun({ campaignId });

      const { status } = await getJson(`/api/events/${campaignId}`);

      expect(status).toBe(404);
    });

    it('returns 404 for an unknown campaign', async () => {
      const { status } = await getJson('/api/events/9999');

      expect(status).toBe(404);
    });

    it('returns 400 for a non-numeric campaign id', async () => {
      const { status } = await getJson('/api/events/not-a-number');

      expect(status).toBe(400);
    });

    it('returns 500 when the campaign query fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const response = await app.request(
        '/api/events/1',
        undefined,
        envFor(createFailingDb(sqlite, 'FROM campaign_definitions')),
      );

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/events/:id/community-progress', () => {
    it('serves public progress and ranked contributors', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId, target: 100 });
      const participantId = insertParticipant(campaignId, runId, 30);
      insertLedgerEntry(participantId, runId, 30);

      const { status, body } = await getJson(`/api/events/${campaignId}/community-progress`);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        campaignSlug: 'beacon-watch',
        targetDistance: 100,
        totalDistance: 30,
        participantCount: 1,
        contributorCount: 1,
        you: null,
      });
      expect(body.contributors?.[0]).toMatchObject({
        rank: 1,
        username: 'frodo',
        distance: 30,
      });
    });

    it('adds the caller contribution and rank when positive', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId });
      insertParticipant(campaignId, runId, 30);

      const { body } = await getJson(
        `/api/events/${campaignId}/community-progress`,
        authed(),
      );

      expect(body.you).toEqual({ distance: 30, rank: 1 });
    });

    it('returns 404 for a disabled campaign', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      insertRun({ campaignId });

      const { status } = await getJson(`/api/events/${campaignId}/community-progress`);

      expect(status).toBe(404);
    });

    it('returns 500 when the progress query fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const response = await app.request(
        '/api/events/1/community-progress',
        undefined,
        envFor(createFailingDb(sqlite, 'FROM campaign_definitions')),
      );

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/events/:id/join', () => {
    it('joins an active run and backfills existing in-window walks', async () => {
      const campaignId = insertCampaign();
      const runId = insertRun({ campaignId, start: TODAY, end: addDays(TODAY, 6) });
      insertWalk(addDays(TODAY, -1), 9);
      insertWalk(TODAY, 5);
      insertWalk(addDays(TODAY, 7), 7);

      const { status, body } = await getJson(
        `/api/events/${campaignId}/join`,
        authed({ method: 'POST' }),
      );

      expect(status).toBe(201);
      expect(body).toMatchObject({
        joined: true,
        campaignId,
        campaignSlug: 'beacon-watch',
        runId,
        runNumber: 1,
        participation: { status: 'active', contributionDistance: 5 },
      });

      const detail = await getJson(`/api/events/${campaignId}`, authed());
      expect(detail.body.participation).toMatchObject({ contributionDistance: 5 });
    });

    it('rejects a duplicate join with 409', async () => {
      const campaignId = insertCampaign();
      insertRun({ campaignId });

      await getJson(`/api/events/${campaignId}/join`, authed({ method: 'POST' }));
      const { status } = await getJson(
        `/api/events/${campaignId}/join`,
        authed({ method: 'POST' }),
      );

      expect(status).toBe(409);
    });

    it('rejects a join to an ended run with 400', async () => {
      const campaignId = insertCampaign();
      insertRun({
        campaignId,
        status: 'active',
        start: addDays(TODAY, -10),
        end: addDays(TODAY, -1),
      });

      const { status } = await getJson(
        `/api/events/${campaignId}/join`,
        authed({ method: 'POST' }),
      );

      expect(status).toBe(400);
    });

    it('rejects a join to a disabled campaign with 400', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      insertRun({ campaignId });

      const { status } = await getJson(
        `/api/events/${campaignId}/join`,
        authed({ method: 'POST' }),
      );

      expect(status).toBe(400);
    });

    it('returns 404 for an unknown campaign', async () => {
      const { status } = await getJson('/api/events/9999/join', authed({ method: 'POST' }));

      expect(status).toBe(404);
    });

    it('returns 401 without a session', async () => {
      const campaignId = insertCampaign();
      insertRun({ campaignId });

      const response = await app.request(`/api/events/${campaignId}/join`, { method: 'POST' }, env);

      expect(response.status).toBe(401);
    });

    it('returns 500 when the participant insert fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const campaignId = insertCampaign();
      insertRun({ campaignId });

      const response = await app.request(
        `/api/events/${campaignId}/join`,
        authed({ method: 'POST' }),
        envFor(createFailingDb(sqlite, 'INSERT INTO campaign_participants')),
      );

      expect(response.status).toBe(500);
    });
  });
});
