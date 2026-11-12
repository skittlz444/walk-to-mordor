// Community campaign notification triggers, end to end through the routes:
// push settings category, run announcements (retrigger + enable) and the
// completion notice sent from walk-save / join reconciliation.
//
// Delivery is captured at the Web Push boundary (the request builder) so the
// flat payload and the recipient set are asserted without any network calls.
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import { app } from '../../src/index';
import type { DbClient } from '../../src/db';
import { addDays, utcToday } from '../../src/event-utils';

jest.mock('../../src/achievement-awards', () => ({
  checkAndAwardJourneyBadges: jest.fn().mockResolvedValue(undefined),
}));

const capturedMessages: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];

jest.mock('@block65/webcrypto-web-push', () => ({
  buildPushPayload: jest.fn(async (message: { data: Record<string, unknown> }, subscription: { endpoint: string }) => {
    capturedMessages.push({ endpoint: subscription.endpoint, payload: message.data });
    return { method: 'POST', headers: {}, body: '' } as RequestInit;
  }),
}));

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const TODAY = utcToday();
const TOMORROW = addDays(TODAY, 1);
const ADMIN_AUTH = 'Bearer TEST_MOCK_TOKEN_frodo';
const BEACON_BADGE = 'community-beacon-watch';

const PREREQUISITE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  approved INTEGER DEFAULT 1,
  is_admin INTEGER DEFAULT 0,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  one_more_mile_enabled INTEGER NOT NULL DEFAULT 1,
  inactivity_nudge_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

const MIGRATIONS = [
  '0121_create_admin_audit_log.sql',
  '0126_create_push_subscriptions.sql',
  '0142_create_achievement_definitions.sql',
  '0143_create_user_achievement_instances.sql',
  '0161_create_campaign_definitions.sql',
  '0162_create_campaign_runs.sql',
  '0163_create_campaign_participants.sql',
  '0164_create_campaign_progress_ledger.sql',
  '0165_seed_beacon_watch_campaign.sql',
  '0166_seed_beacon_watch_run.sql',
  '0167_seed_beacon_watch_badge.sql',
  '0168_add_community_campaigns_enabled.sql',
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
  } as unknown as D1Database;

  const batch = async (statements: Array<{ run: () => Promise<unknown> }>) => {
    database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      database.exec('COMMIT');
      return results;
    } catch (error: unknown) {
      database.exec('ROLLBACK');
      throw error;
    }
  };
  (connection as unknown as { batch: typeof batch }).batch = batch;

  return {
    read: connection as unknown as D1Database,
    write: connection as unknown as D1Database,
  };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function envFor(db: DbClient): Env {
  return {
    DB: db.read,
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    ALLOW_TEST_AUTH: 'true',
    VAPID_PUBLIC_KEY: 'test-public-key',
    VAPID_PRIVATE_KEY: 'test-private-key',
    VAPID_SUBJECT: 'mailto:test@example.com',
  } as unknown as Env;
}

/** Env whose D1 throws when a statement contains `fragment`. */
function envWithPrepareFailure(db: DbClient, fragment: string): Env {
  const base = db.read as unknown as {
    prepare(sql: string): unknown;
    batch?: (...args: unknown[]) => unknown;
  };
  const wrapped = {
    prepare(sql: string) {
      if (sql.includes(fragment)) throw new Error(`injected failure: ${fragment}`);
      return base.prepare(sql);
    },
    batch: base.batch?.bind(base),
  } as unknown as D1Database;

  return { ...(envFor(db) as unknown as Record<string, unknown>), DB: wrapped } as unknown as Env;
}

/** Collects `ctx.waitUntil` promises so the test can await background delivery. */
function createExecutionContext(): { context: ExecutionContext; pending: Promise<unknown>[] } {
  const pending: Promise<unknown>[] = [];
  const context = {
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
    passThroughOnException: () => undefined,
  } as unknown as ExecutionContext;
  return { context, pending };
}

function authed(
  auth: string,
  method = 'GET',
  body?: unknown,
): RequestInit {
  return {
    method,
    headers: {
      Authorization: auth,
      'content-type': 'application/json',
      'CF-Connecting-IP': '203.0.113.9',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

interface CampaignSeed {
  slug: string;
  name: string;
  enabled: number;
  badgeSlug?: string | null;
}

describe('community campaign notifications', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let env: Env;
  let samId: number;
  let merryId: number;
  let pippinId: number;
  let bilboId: number;
  let gandalfId: number;

  function insertUser(
    username: string,
    options: { admin?: boolean; communityCampaignsEnabled?: number } = {},
  ): number {
    const result = sqlite.prepare(
      `INSERT INTO users (username, email, approved, is_admin, community_campaigns_enabled)
       VALUES (?, ?, 1, ?, ?)`,
    ).run(
      username,
      `${username}@example.com`,
      options.admin ? 1 : 0,
      options.communityCampaignsEnabled ?? 1,
    );
    return Number(result.lastInsertRowid);
  }

  function subscribe(userId: number, endpoint: string): void {
    sqlite.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
       VALUES (?, ?, 'p256dh-key', 'auth-key')`,
    ).run(userId, endpoint);
  }

  function insertCampaign(seed: CampaignSeed): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_definitions (slug, name, description, enabled, badge_slug)
       VALUES (?, ?, 'A community campaign.', ?, ?)`,
    ).run(seed.slug, seed.name, seed.enabled, seed.badgeSlug ?? null);
    return Number(result.lastInsertRowid);
  }

  function insertRun(
    campaignId: number,
    options: {
      runNumber?: number;
      target?: number;
      start?: string;
      end?: string;
      status?: string;
    } = {},
  ): number {
    const result = sqlite.prepare(
      `INSERT INTO campaign_runs
         (campaign_id, run_number, target_distance, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      campaignId,
      options.runNumber ?? 1,
      options.target ?? 100,
      options.start ?? TODAY,
      options.end ?? addDays(TODAY, 6),
      options.status ?? 'active',
    );
    return Number(result.lastInsertRowid);
  }

  function insertParticipant(
    campaignId: number,
    runId: number,
    userId: number,
    progressDistance: number,
    status: 'active' | 'removed' = 'active',
  ): void {
    sqlite.prepare(
      `INSERT INTO campaign_participants
         (campaign_id, run_id, user_id, progress_distance, status)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(campaignId, runId, userId, progressDistance, status);
  }

  function runRow(runId: number): { announced_at: string | null; status: string; run_number: number } {
    return sqlite.prepare(
      'SELECT announced_at, status, run_number FROM campaign_runs WHERE id = ?',
    ).get(runId) as { announced_at: string | null; status: string; run_number: number };
  }

  async function request(
    url: string,
    init: RequestInit = authed(ADMIN_AUTH),
  ): Promise<{ response: Response; pending: Promise<unknown>[]; sent: typeof capturedMessages }> {
    const { context, pending } = createExecutionContext();
    capturedMessages.length = 0;
    const response = await app.request(url, init, env, context);
    return { response, pending, sent: capturedMessages };
  }

  beforeEach(() => {
    capturedMessages.length = 0;
    global.fetch = jest.fn(async () => new Response(null, { status: 201 })) as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    for (const filename of MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }

    db = createTestDb(sqlite);
    env = envFor(db);

    insertUser('frodo', { admin: true });
    samId = insertUser('sam');
    merryId = insertUser('merry');
    pippinId = insertUser('pippin');
    bilboId = insertUser('bilbo', { communityCampaignsEnabled: 0 });
    gandalfId = insertUser('gandalf');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  describe('push settings category', () => {
    it('returns communityCampaignsEnabled in push status and defaults to true', async () => {
      const { response } = await request('/api/push/status', authed('Bearer TEST_MOCK_TOKEN_sam'));
      const body = await response.json() as { data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(body.data.communityCampaignsEnabled).toBe(true);

      sqlite.prepare('UPDATE users SET community_campaigns_enabled = 0 WHERE id = ?').run(samId);
      const { response: updated } = await request('/api/push/status', authed('Bearer TEST_MOCK_TOKEN_sam'));
      const updatedBody = await updated.json() as { data: Record<string, unknown> };
      expect(updatedBody.data.communityCampaignsEnabled).toBe(false);
    });

    it('accepts a body containing only communityCampaignsEnabled and persists it', async () => {
      const { response } = await request(
        '/api/push/settings',
        authed('Bearer TEST_MOCK_TOKEN_sam', 'PUT', { communityCampaignsEnabled: false }),
      );

      expect(response.status).toBe(200);

      const row = sqlite.prepare(
        'SELECT community_campaigns_enabled FROM users WHERE id = ?',
      ).get(samId) as { community_campaigns_enabled: number };
      expect(row.community_campaigns_enabled).toBe(0);
    });

    it('rejects a non-boolean communityCampaignsEnabled', async () => {
      const { response } = await request(
        '/api/push/settings',
        authed('Bearer TEST_MOCK_TOKEN_sam', 'PUT', { communityCampaignsEnabled: 'yes' }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'communityCampaignsEnabled must be a boolean',
      });
    });
  });

  describe('run announcement', () => {
    it('announces a retriggered run to subscribers with the category enabled only', async () => {
      subscribe(gandalfId, 'https://push.example/gandalf');
      subscribe(bilboId, 'https://push.example/bilbo');

      const campaignId = insertCampaign({ slug: 'light-the-beacons', name: 'Light the Beacons', enabled: 1 });
      insertRun(campaignId, { status: 'completed' });

      const { response, pending, sent } = await request(
        `/api/admin/campaigns/${campaignId}/retrigger`,
        authed(ADMIN_AUTH, 'POST', {}),
      );
      const body = await response.json() as { run: { id: number; run_number: number } };
      await Promise.all(pending);

      expect(response.status).toBe(201);
      expect(body.run.run_number).toBe(2);
      expect(sent.map((entry) => entry.endpoint)).toEqual(['https://push.example/gandalf']);
      expect(sent[0].payload).toEqual({
        title: 'Community campaign',
        body: '"Light the Beacons" is live — rally the community to the target!',
        url: '/events',
        type: 'community_campaign_created',
        campaignSlug: 'light-the-beacons',
        runNumber: '2',
      });
      expect(runRow(body.run.id).announced_at).not.toBeNull();
    });

    it('only announces runs whose announced_at is still NULL', async () => {
      subscribe(gandalfId, 'https://push.example/gandalf');

      const campaignId = insertCampaign({ slug: 'beacon-watch-2', name: 'Beacon Watch 2', enabled: 1 });
      const runId = insertRun(campaignId, { status: 'completed' });

      // Simulate an already-announced run: the guarded stamp must not fire.
      sqlite.prepare('UPDATE campaign_runs SET announced_at = CURRENT_TIMESTAMP WHERE id = ?').run(runId);

      const { response, pending, sent } = await request(
        `/api/admin/campaigns/${campaignId}/retrigger`,
        authed(ADMIN_AUTH, 'POST', {}),
      );
      await Promise.all(pending);

      expect(response.status).toBe(201);
      // The new run is announced once; the stale one stays stamped.
      expect(sent).toHaveLength(1);
      expect(sent[0].payload.runNumber).toBe('2');
    });

    it('announces a migration-seeded run only when the campaign is enabled, exactly once', async () => {
      subscribe(gandalfId, 'https://push.example/gandalf');
      subscribe(bilboId, 'https://push.example/bilbo');

      const seeded = sqlite.prepare(
        'SELECT id FROM campaign_definitions WHERE slug = ?',
      ).get('beacon-watch') as { id: number };
      const seededRun = sqlite.prepare(
        'SELECT id, announced_at FROM campaign_runs WHERE campaign_id = ?',
      ).get(seeded.id) as { id: number; announced_at: string | null };

      expect(seededRun.announced_at).toBeNull();

      const first = await request(`/api/admin/campaigns/${seeded.id}/enable`, authed(ADMIN_AUTH, 'PUT'));
      await Promise.all(first.pending);
      expect(first.response.status).toBe(200);
      expect(first.sent).toHaveLength(1);
      expect(first.sent[0].payload.type).toBe('community_campaign_created');
      expect(first.sent[0].payload.runNumber).toBe('1');
      expect(runRow(seededRun.id).announced_at).not.toBeNull();

      const disabled = await request(
        `/api/admin/campaigns/${seeded.id}/disable`,
        authed(ADMIN_AUTH, 'PUT', {}),
      );
      await Promise.all(disabled.pending);
      expect(disabled.response.status).toBe(200);
      expect(disabled.sent).toHaveLength(0);

      const second = await request(`/api/admin/campaigns/${seeded.id}/enable`, authed(ADMIN_AUTH, 'PUT'));
      await Promise.all(second.pending);
      expect(second.response.status).toBe(200);
      expect(second.sent).toHaveLength(0);
    });
  });

  describe('completion notice', () => {
    it('notifies only active contributors with the category enabled', async () => {
      subscribe(samId, 'https://push.example/sam');
      subscribe(merryId, 'https://push.example/merry');
      subscribe(pippinId, 'https://push.example/pippin');
      subscribe(bilboId, 'https://push.example/bilbo');

      const campaignId = insertCampaign({
        slug: 'ride-of-the-rohirrim',
        name: 'Ride of the Rohirrim',
        enabled: 1,
        badgeSlug: BEACON_BADGE,
      });
      const runId = insertRun(campaignId, { target: 10 });

      insertParticipant(campaignId, runId, samId, 0);
      insertParticipant(campaignId, runId, merryId, 0);
      insertParticipant(campaignId, runId, pippinId, 50, 'removed');
      insertParticipant(campaignId, runId, bilboId, 5);

      const { response, pending, sent } = await request(
        '/api/calendar-progress',
        authed('Bearer TEST_MOCK_TOKEN_sam', 'POST', { start: TODAY, title: 10 }),
      );
      await Promise.all(pending);

      expect(response.status).toBe(201);
      expect(runRow(runId).status).toBe('completed');
      expect(sent.map((entry) => entry.endpoint)).toEqual(['https://push.example/sam']);
      expect(sent[0].payload).toEqual({
        title: 'Campaign completed',
        body: 'Campaign "Ride of the Rohirrim" has been completed! Well done!',
        url: '/events',
        type: 'community_campaign_completed',
        campaignSlug: 'ride-of-the-rohirrim',
        runNumber: '1',
      });
    });

    it('sends the completion notice even when the campaign has no badge', async () => {
      subscribe(samId, 'https://push.example/sam');

      const campaignId = insertCampaign({
        slug: 'beacon-relay',
        name: 'Beacon Relay',
        enabled: 1,
        badgeSlug: null,
      });
      const runId = insertRun(campaignId, { target: 5 });
      insertParticipant(campaignId, runId, samId, 0);

      const { response, pending, sent } = await request(
        '/api/calendar-progress',
        authed('Bearer TEST_MOCK_TOKEN_sam', 'POST', { start: TODAY, title: 5 }),
      );
      await Promise.all(pending);

      expect(response.status).toBe(201);
      expect(runRow(runId).status).toBe('completed');
      expect(sent).toHaveLength(1);
      expect(sent[0].payload.type).toBe('community_campaign_completed');
    });

    it('completes and notifies when a join-time backfill crosses the target', async () => {
      subscribe(samId, 'https://push.example/sam');

      const campaignId = insertCampaign({
        slug: 'muster-of-rohan',
        name: 'Muster of Rohan',
        enabled: 1,
        badgeSlug: null,
      });
      const runId = insertRun(campaignId, { target: 12 });

      // sam already walked inside the run window before joining.
      sqlite.prepare(
        'INSERT INTO progress (date, distance, user_id) VALUES (?, 12, ?)',
      ).run(TODAY, samId);

      const { response, pending, sent } = await request(
        `/api/events/${campaignId}/join`,
        authed('Bearer TEST_MOCK_TOKEN_sam', 'POST'),
      );
      await Promise.all(pending);

      expect(response.status).toBe(201);
      expect(runRow(runId).status).toBe('completed');
      expect(sent.map((entry) => entry.endpoint)).toEqual(['https://push.example/sam']);
      expect(sent[0].payload.campaignSlug).toBe('muster-of-rohan');
    });

    it('does not notify a participant who contributed zero distance', async () => {
      subscribe(samId, 'https://push.example/sam');
      subscribe(merryId, 'https://push.example/merry');

      const campaignId = insertCampaign({
        slug: 'silent-watch',
        name: 'Silent Watch',
        enabled: 1,
        badgeSlug: null,
      });
      const runId = insertRun(campaignId, { target: 5 });
      insertParticipant(campaignId, runId, samId, 0);
      insertParticipant(campaignId, runId, merryId, 0);

      const { response, pending, sent } = await request(
        '/api/calendar-progress',
        authed('Bearer TEST_MOCK_TOKEN_sam', 'POST', { start: TODAY, title: 5 }),
      );
      await Promise.all(pending);

      expect(response.status).toBe(201);
      expect(sent.map((entry) => entry.endpoint)).toEqual(['https://push.example/sam']);
    });
  });

  describe('delivery failures', () => {
    it('still creates the run when push delivery throws', async () => {
      global.fetch = jest.fn(async () => {
        throw new Error('push service unavailable');
      }) as unknown as typeof fetch;

      subscribe(gandalfId, 'https://push.example/gandalf');

      const campaignId = insertCampaign({ slug: 'broken-beacon', name: 'Broken Beacon', enabled: 1 });
      insertRun(campaignId, { status: 'expired' });

      const { response, pending } = await request(
        `/api/admin/campaigns/${campaignId}/retrigger`,
        authed(ADMIN_AUTH, 'POST', {}),
      );
      await Promise.all(pending);

      expect(response.status).toBe(201);
      const body = await response.json() as { run: { id: number; run_number: number } };
      expect(body.run.run_number).toBe(2);
      expect(runRow(body.run.id).announced_at).not.toBeNull();
    });

    it('still enables the campaign when the announcement stamp fails', async () => {
      subscribe(gandalfId, 'https://push.example/gandalf');

      const seeded = sqlite.prepare(
        'SELECT id FROM campaign_definitions WHERE slug = ?',
      ).get('beacon-watch') as { id: number };

      const failingEnv = envWithPrepareFailure(db, 'SET announced_at = CURRENT_TIMESTAMP');
      const { context, pending } = createExecutionContext();
      capturedMessages.length = 0;
      const response = await app.request(
        `/api/admin/campaigns/${seeded.id}/enable`,
        authed(ADMIN_AUTH, 'PUT'),
        failingEnv,
        context,
      );
      await Promise.all(pending);

      expect(response.status).toBe(200);
      const campaign = sqlite.prepare(
        'SELECT enabled FROM campaign_definitions WHERE id = ?',
      ).get(seeded.id) as { enabled: number };
      expect(campaign.enabled).toBe(1);
      expect(capturedMessages).toHaveLength(0);
    });

    it('still completes the run when the notification query fails', async () => {
      subscribe(samId, 'https://push.example/sam');

      const campaignId = insertCampaign({
        slug: 'broken-audience',
        name: 'Broken Audience',
        enabled: 1,
        badgeSlug: null,
      });
      const runId = insertRun(campaignId, { target: 5 });
      insertParticipant(campaignId, runId, samId, 0);

      // Drop the audience table dependency to force the background task to fail.
      sqlite.exec('DROP TABLE push_subscriptions');

      const { response, pending } = await request(
        '/api/calendar-progress',
        authed('Bearer TEST_MOCK_TOKEN_sam', 'POST', { start: TOMORROW, title: 5 }),
      );
      await Promise.all(pending);

      expect(response.status).toBe(201);
      expect(runRow(runId).status).toBe('completed');
    });
  });
});
