import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

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
  '0165_seed_beacon_watch_campaign.sql',
  '0166_seed_beacon_watch_run.sql',
  '0167_seed_beacon_watch_badge.sql',
];

interface CampaignSeedRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string;
  badge_slug: string;
  enabled: number;
}

interface RunRow {
  id: number;
  campaign_id: number;
  run_number: number;
  target_distance: number;
  start_date: string;
  end_date: string;
  status: string;
  completed_at: string | null;
  announced_at: string | null;
  participant_count: number | null;
  contributor_count: number | null;
  total_distance: number | null;
}

interface BadgeRow {
  slug: string;
  name: string;
  description: string;
  image_slug: string;
  badge_type: string;
  is_repeatable: number;
  metadata: string;
}

interface BadgeMetadata {
  storyline: string | null;
  rank_thresholds: number[];
  unit: string;
  criteria: string;
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function applyCampaignMigrations(sqlite: DatabaseSync): void {
  for (const filename of CAMPAIGN_MIGRATIONS) {
    sqlite.exec(readMigration(filename));
  }
}

function createDatabase(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(PREREQUISITE_SCHEMA);
  sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
  applyCampaignMigrations(sqlite);
  return sqlite;
}

function tableColumns(sqlite: DatabaseSync, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function utcDatePlusDays(days: number, from: Date = new Date()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function seededCampaign(sqlite: DatabaseSync): CampaignSeedRow {
  return sqlite.prepare(
    `SELECT id, slug, name, description, image_slug, badge_slug, enabled
     FROM campaign_definitions WHERE slug = 'beacon-watch'`,
  ).get() as unknown as CampaignSeedRow;
}

function insertUser(sqlite: DatabaseSync, username: string): number {
  const result = sqlite.prepare('INSERT INTO users (username) VALUES (?)').run(username);
  return Number(result.lastInsertRowid);
}

function insertProgress(
  sqlite: DatabaseSync,
  userId: number,
  date: string,
  distance: number,
): number {
  const result = sqlite
    .prepare('INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)')
    .run(date, distance, userId);
  return Number(result.lastInsertRowid);
}

function insertParticipant(
  sqlite: DatabaseSync,
  campaignId: number,
  runId: number,
  userId: number,
): number {
  const result = sqlite
    .prepare(
      `INSERT INTO campaign_participants (campaign_id, run_id, user_id)
       VALUES (?, ?, ?)`,
    )
    .run(campaignId, runId, userId);
  return Number(result.lastInsertRowid);
}

describe('community campaign migrations (0161-0167)', () => {
  let sqlite: DatabaseSync;
  // The seed migration resolves date('now') when it runs, so bracket the
  // creation instant: if the UTC date rolls between the two captures both
  // candidates are valid; normally both captures agree and the assertion is
  // exact.
  let seedWindowStart: Date;
  let seedWindowEnd: Date;

  beforeEach(() => {
    seedWindowStart = new Date();
    sqlite = createDatabase();
    seedWindowEnd = new Date();
  });

  afterEach(() => {
    sqlite.close();
  });

  it('creates every campaign table with the required columns', () => {
    expect(tableColumns(sqlite, 'campaign_definitions')).toEqual([
      'id',
      'slug',
      'name',
      'description',
      'image_slug',
      'badge_slug',
      'enabled',
      'created_at',
      'updated_at',
    ]);

    expect(tableColumns(sqlite, 'campaign_runs')).toEqual([
      'id',
      'campaign_id',
      'run_number',
      'target_distance',
      'start_date',
      'end_date',
      'status',
      'completed_at',
      'announced_at',
      'participant_count',
      'contributor_count',
      'total_distance',
      'created_at',
      'updated_at',
    ]);

    expect(tableColumns(sqlite, 'campaign_participants')).toEqual([
      'id',
      'campaign_id',
      'run_id',
      'user_id',
      'progress_distance',
      'joined_at',
      'status',
      'removed_at',
      'created_at',
      'updated_at',
    ]);

    expect(tableColumns(sqlite, 'campaign_progress_ledger')).toEqual([
      'id',
      'participant_id',
      'run_id',
      'source_progress_id',
      'distance',
      'created_at',
      'updated_at',
    ]);
  });

  it('creates the documented indexes', () => {
    const names = (sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name",
    ).all() as Array<{ name: string }>).map((row) => row.name);

    expect(names).toEqual(expect.arrayContaining([
      'idx_campaign_definitions_slug',
      'idx_campaign_definitions_enabled',
      'idx_campaign_runs_campaign_status',
      'idx_campaign_runs_one_current',
      'idx_campaign_participants_run_id',
      'idx_campaign_progress_ledger_participant_id',
    ]));
  });

  it('seeds the Beacon Watch definition disabled with copy and artwork slugs', () => {
    const campaign = seededCampaign(sqlite);

    expect(campaign).toBeDefined();
    expect(campaign.name).toBe('Beacon Watch');
    expect(campaign.description.length).toBeGreaterThan(0);
    expect(campaign.image_slug).toBe('beacon-watch');
    expect(campaign.badge_slug).toBe('community-beacon-watch');
    expect(campaign.enabled).toBe(0);
  });

  it('seeds run 1 as an upcoming 14-day 581 km window', () => {
    const campaign = seededCampaign(sqlite);
    const runs = sqlite.prepare(
      `SELECT id, campaign_id, run_number, target_distance, start_date, end_date,
              status, completed_at, announced_at, participant_count,
              contributor_count, total_distance
       FROM campaign_runs WHERE campaign_id = ?`,
    ).all(campaign.id) as unknown as RunRow[];

    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run.run_number).toBe(1);
    expect(run.status).toBe('upcoming');
    expect(run.target_distance).toBe(581);
    expect([utcDatePlusDays(1, seedWindowStart), utcDatePlusDays(1, seedWindowEnd)])
      .toContain(run.start_date);
    expect([utcDatePlusDays(14, seedWindowStart), utcDatePlusDays(14, seedWindowEnd)])
      .toContain(run.end_date);
    expect(run.completed_at).toBeNull();
    expect(run.announced_at).toBeNull();
    expect(run.participant_count).toBeNull();
    expect(run.contributor_count).toBeNull();
    expect(run.total_distance).toBeNull();
  });

  it('seeds the repeatable community badge with thresholds and no fixed rank', () => {
    const rows = sqlite.prepare(
      `SELECT slug, name, description, image_slug, badge_type, is_repeatable, metadata
       FROM achievement_definitions WHERE slug = 'community-beacon-watch'`,
    ).all() as unknown as BadgeRow[];

    expect(rows).toHaveLength(1);
    const badge = rows[0];
    expect(badge.name.length).toBeGreaterThan(0);
    expect(badge.description.length).toBeGreaterThan(0);
    expect(badge.image_slug).toBe('community-beacon-watch');
    expect(badge.badge_type).toBe('community');
    expect(badge.is_repeatable).toBe(1);

    const metadata = JSON.parse(badge.metadata) as BadgeMetadata & { rank?: number };
    expect(metadata.storyline).toBeNull();
    expect(metadata.rank_thresholds).toEqual([1, 3, 7, 15]);
    expect(metadata.rank).toBeUndefined();
    expect(metadata.criteria).toBe('community_campaign_completed');
  });

  it('is idempotent when the campaign migrations are applied twice', () => {
    const columnsBefore = tableColumns(sqlite, 'campaign_runs');

    expect(() => applyCampaignMigrations(sqlite)).not.toThrow();

    expect(tableColumns(sqlite, 'campaign_runs')).toEqual(columnsBefore);
    const campaignCount = sqlite.prepare(
      'SELECT COUNT(*) AS count FROM campaign_definitions',
    ).get() as { count: number };
    const runCount = sqlite.prepare(
      'SELECT COUNT(*) AS count FROM campaign_runs',
    ).get() as { count: number };
    const badgeCount = sqlite.prepare(
      "SELECT COUNT(*) AS count FROM achievement_definitions WHERE slug = 'community-beacon-watch'",
    ).get() as { count: number };
    expect(campaignCount.count).toBe(1);
    expect(runCount.count).toBe(1);
    expect(badgeCount.count).toBe(1);
  });

  it('rejects duplicate campaign slugs', () => {
    expect(() =>
      sqlite.exec(
        `INSERT INTO campaign_definitions (slug, name, description)
         VALUES ('beacon-watch', 'Duplicate', 'Duplicate')`,
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('rejects duplicate run numbers within a campaign', () => {
    const campaign = seededCampaign(sqlite);

    expect(() =>
      sqlite.exec(
        `INSERT INTO campaign_runs (campaign_id, run_number, target_distance, start_date, end_date, status)
         VALUES (${campaign.id}, 1, 100.0, '2026-06-01', '2026-06-10', 'completed')`,
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('allows at most one upcoming or active run per campaign', () => {
    const campaign = seededCampaign(sqlite);

    // The seeded run is upcoming, so a second current run must be rejected.
    expect(() =>
      sqlite.exec(
        `INSERT INTO campaign_runs (campaign_id, run_number, target_distance, start_date, end_date, status)
         VALUES (${campaign.id}, 2, 100.0, '2026-06-01', '2026-06-10', 'active')`,
      ),
    ).toThrow(/UNIQUE constraint/);

    // A terminal run is still allowed alongside history once no current run exists.
    sqlite.exec(`UPDATE campaign_runs SET status = 'completed' WHERE campaign_id = ${campaign.id}`);
    expect(() =>
      sqlite.exec(
        `INSERT INTO campaign_runs (campaign_id, run_number, target_distance, start_date, end_date, status)
         VALUES (${campaign.id}, 2, 100.0, '2026-06-01', '2026-06-10', 'expired')`,
      ),
    ).not.toThrow();
  });

  it('rejects duplicate participation per user, campaign, and run', () => {
    const campaign = seededCampaign(sqlite);
    const run = sqlite.prepare(
      'SELECT id FROM campaign_runs WHERE campaign_id = ?',
    ).get(campaign.id) as { id: number };
    const userId = insertUser(sqlite, 'frodo');

    insertParticipant(sqlite, campaign.id, run.id, userId);

    expect(() => insertParticipant(sqlite, campaign.id, run.id, userId))
      .toThrow(/UNIQUE constraint/);
  });

  it('rejects duplicate ledger rows for the same participant and walk', () => {
    const campaign = seededCampaign(sqlite);
    const run = sqlite.prepare(
      'SELECT id FROM campaign_runs WHERE campaign_id = ?',
    ).get(campaign.id) as { id: number };
    const userId = insertUser(sqlite, 'frodo');
    const progressId = insertProgress(sqlite, userId, '2026-06-03', 5);
    const participantId = insertParticipant(sqlite, campaign.id, run.id, userId);

    sqlite.exec(
      `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
       VALUES (${participantId}, ${run.id}, ${progressId}, 5.0)`,
    );

    expect(() =>
      sqlite.exec(
        `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
         VALUES (${participantId}, ${run.id}, ${progressId}, 5.0)`,
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('cascades user deletion through participants and ledger rows', () => {
    const campaign = seededCampaign(sqlite);
    const run = sqlite.prepare(
      'SELECT id FROM campaign_runs WHERE campaign_id = ?',
    ).get(campaign.id) as { id: number };
    const userId = insertUser(sqlite, 'frodo');
    const progressId = insertProgress(sqlite, userId, '2026-06-03', 5);
    const participantId = insertParticipant(sqlite, campaign.id, run.id, userId);
    sqlite.exec(
      `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
       VALUES (${participantId}, ${run.id}, ${progressId}, 5.0)`,
    );

    sqlite.exec(`DELETE FROM users WHERE id = ${userId}`);

    for (const table of ['campaign_participants', 'campaign_progress_ledger']) {
      const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
      expect(row.count).toBe(0);
    }
  });

  it('cascades ledger rows when the source walk is deleted', () => {
    const campaign = seededCampaign(sqlite);
    const run = sqlite.prepare(
      'SELECT id FROM campaign_runs WHERE campaign_id = ?',
    ).get(campaign.id) as { id: number };
    const userId = insertUser(sqlite, 'frodo');
    const progressId = insertProgress(sqlite, userId, '2026-06-03', 5);
    const participantId = insertParticipant(sqlite, campaign.id, run.id, userId);
    sqlite.exec(
      `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
       VALUES (${participantId}, ${run.id}, ${progressId}, 5.0)`,
    );

    sqlite.exec(`DELETE FROM progress WHERE id = ${progressId}`);

    const row = sqlite.prepare(
      'SELECT COUNT(*) AS count FROM campaign_progress_ledger',
    ).get() as { count: number };
    expect(row.count).toBe(0);
  });

  it('cascades run deletion through participants and ledger rows', () => {
    const campaign = seededCampaign(sqlite);
    const run = sqlite.prepare(
      'SELECT id FROM campaign_runs WHERE campaign_id = ?',
    ).get(campaign.id) as { id: number };
    const userId = insertUser(sqlite, 'frodo');
    const progressId = insertProgress(sqlite, userId, '2026-06-03', 5);
    const participantId = insertParticipant(sqlite, campaign.id, run.id, userId);
    sqlite.exec(
      `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
       VALUES (${participantId}, ${run.id}, ${progressId}, 5.0)`,
    );

    sqlite.exec(`DELETE FROM campaign_runs WHERE id = ${run.id}`);

    for (const table of ['campaign_participants', 'campaign_progress_ledger']) {
      const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
      expect(row.count).toBe(0);
    }
  });
});
