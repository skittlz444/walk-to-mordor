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

const EVENT_MIGRATIONS = [
  '0152_create_personal_encounter_definitions.sql',
  '0153_create_encounter_occurrences.sql',
  '0154_create_daily_rolls.sql',
  '0155_create_event_participants.sql',
  '0156_create_event_progress_ledger.sql',
  '0157_seed_nazgul_encounter.sql',
  '0158_seed_nazgul_badge.sql',
  '0159_rebuild_legacy_event_tables.sql',
];

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function applyPrerequisites(sqlite: DatabaseSync): void {
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(PREREQUISITE_SCHEMA);
  sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
  sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
}

function applyEventMigrations(sqlite: DatabaseSync): void {
  for (const filename of EVENT_MIGRATIONS) {
    sqlite.exec(readMigration(filename));
  }
}

function createDatabase(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  applyPrerequisites(sqlite);
  applyEventMigrations(sqlite);
  return sqlite;
}

function tableColumns(sqlite: DatabaseSync, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

interface SeedRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string;
  badge_slug: string;
  duration_days: number;
  target_stretch_multiplier: number;
  target_min_distance: number;
  target_max_distance: number;
  is_repeatable: number;
  enabled: number;
}

interface BadgeRow {
  id: number;
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

describe('personal challenge migrations (0152-0159)', () => {
  let sqlite: DatabaseSync;

  beforeEach(() => {
    sqlite = createDatabase();
  });

  afterEach(() => {
    sqlite.close();
  });

  it('creates every personal challenge table with the required columns', () => {
    expect(tableColumns(sqlite, 'personal_encounter_definitions')).toEqual([
      'id',
      'slug',
      'name',
      'description',
      'image_slug',
      'badge_slug',
      'duration_days',
      'target_stretch_multiplier',
      'target_min_distance',
      'target_max_distance',
      'is_repeatable',
      'enabled',
      'created_at',
      'updated_at',
    ]);

    expect(tableColumns(sqlite, 'encounter_occurrences')).toEqual([
      'id',
      'definition_id',
      'user_id',
      'daily_roll_id',
      'status',
      'personalized_target',
      'started_at',
      'coverage_end_date',
      'grace_deadline',
      'completed_at',
      'created_at',
      'updated_at',
    ]);

    expect(tableColumns(sqlite, 'daily_rolls')).toEqual([
      'id',
      'user_id',
      'roll_date',
      'encounter_definition_id',
      'preview_target_distance',
      'status',
      'created_at',
      'updated_at',
    ]);

    expect(tableColumns(sqlite, 'event_participants')).toEqual([
      'id',
      'occurrence_id',
      'user_id',
      'progress_distance',
      'joined_at',
      'created_at',
      'updated_at',
    ]);

    expect(tableColumns(sqlite, 'event_progress_ledger')).toEqual([
      'id',
      'participant_id',
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
      'idx_personal_encounter_definitions_slug',
      'idx_personal_encounter_definitions_enabled',
      'idx_encounter_occurrences_user_status',
      'idx_encounter_occurrences_status_grace',
      'idx_daily_rolls_roll_date',
      'idx_event_participants_user_id',
      'idx_event_progress_ledger_participant_id',
    ]));
  });

  it('is idempotent when the new migrations are applied twice', () => {
    const columnsBefore = tableColumns(sqlite, 'encounter_occurrences');

    expect(() => applyEventMigrations(sqlite)).not.toThrow();

    expect(tableColumns(sqlite, 'encounter_occurrences')).toEqual(columnsBefore);
    const definitionCount = sqlite.prepare(
      'SELECT COUNT(*) AS count FROM personal_encounter_definitions',
    ).get() as { count: number };
    const badgeCount = sqlite.prepare(
      "SELECT COUNT(*) AS count FROM achievement_definitions WHERE slug = 'challenge-nazgul-outrun'",
    ).get() as { count: number };
    expect(definitionCount.count).toBe(1);
    expect(badgeCount.count).toBe(1);
  });

  it('seeds the Nazgul pursuit definition with the configured values', () => {
    const row = sqlite.prepare(
      `SELECT id, slug, name, description, image_slug, badge_slug, duration_days,
              target_stretch_multiplier, target_min_distance, target_max_distance,
              is_repeatable, enabled
       FROM personal_encounter_definitions
       WHERE slug = 'nazgul-pursuit'`,
    ).get() as unknown as SeedRow;

    expect(row).toBeDefined();
    expect(row.slug).toBe('nazgul-pursuit');
    expect(row.name).toBe('Outrun the Nazgûl');
    expect(row.description.length).toBeGreaterThan(0);
    expect(row.image_slug).toBe('nazgul-pursuit');
    expect(row.badge_slug).toBe('challenge-nazgul-outrun');
    expect(row.duration_days).toBe(3);
    expect(row.target_stretch_multiplier).toBe(1.3);
    expect(row.target_min_distance).toBe(3.0);
    expect(row.target_max_distance).toBe(50.0);
    expect(row.is_repeatable).toBe(1);
    expect(row.enabled).toBe(1);
  });

  it('seeds the challenge badge metadata and does not duplicate it', () => {
    const rows = sqlite.prepare(
      `SELECT id, slug, name, description, image_slug, badge_type, is_repeatable, metadata
       FROM achievement_definitions
       WHERE slug = 'challenge-nazgul-outrun'`,
    ).all() as unknown as BadgeRow[];

    expect(rows).toHaveLength(1);
    const badge = rows[0];
    expect(badge.name.length).toBeGreaterThan(0);
    expect(badge.description.length).toBeGreaterThan(0);
    expect(badge.image_slug).toBe('challenge-nazgul-outrun');
    expect(badge.badge_type).toBe('challenge');
    expect(badge.is_repeatable).toBe(1);

    const metadata = JSON.parse(badge.metadata) as BadgeMetadata;
    expect(metadata.storyline).toBeNull();
    expect(metadata.rank_thresholds).toEqual([1, 2, 3, 5]);
    expect(metadata.unit).toBe('pursuits');
    expect(metadata.criteria).toBe('personal_encounter_completed');
  });

  it('repairs a legacy prototype event schema instead of silently keeping it', () => {
    const legacy = new DatabaseSync(':memory:');
    try {
      legacy.exec('PRAGMA foreign_keys = ON;');
      legacy.exec(PREREQUISITE_SCHEMA);
      legacy.exec(readMigration('0142_create_achievement_definitions.sql'));
      legacy.exec(readMigration('0143_create_user_achievement_instances.sql'));
      legacy.exec(`
        CREATE TABLE event_templates (id INTEGER PRIMARY KEY AUTOINCREMENT);
        CREATE TABLE event_occurrences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          FOREIGN KEY (template_id) REFERENCES event_templates(id)
        );
        CREATE TABLE event_participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          occurrence_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          progress_distance REAL NOT NULL DEFAULT 0,
          joined_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME,
          updated_at DATETIME,
          FOREIGN KEY (occurrence_id) REFERENCES event_occurrences(id)
        );
        CREATE TABLE event_progress_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          participant_id INTEGER NOT NULL,
          source_progress_id INTEGER NOT NULL,
          distance_credited REAL NOT NULL,
          credited_at DATETIME,
          FOREIGN KEY (participant_id) REFERENCES event_participants(id),
          FOREIGN KEY (source_progress_id) REFERENCES progress(id)
        );
        INSERT INTO users (username) VALUES ('frodo');
        INSERT INTO event_templates DEFAULT VALUES;
        INSERT INTO event_occurrences (template_id) VALUES (1), (1);
        INSERT INTO event_participants (occurrence_id, user_id) VALUES (1, 1);
        INSERT INTO progress (date, distance, user_id) VALUES ('2026-06-01', 5.0, 1);
        INSERT INTO event_progress_ledger (participant_id, source_progress_id, distance_credited)
          VALUES (1, 1, 5.0);
      `);

      applyEventMigrations(legacy);

      expect(tableColumns(legacy, 'event_participants')).toEqual([
        'id',
        'occurrence_id',
        'user_id',
        'progress_distance',
        'joined_at',
        'created_at',
        'updated_at',
      ]);
      expect(tableColumns(legacy, 'event_progress_ledger')).toEqual([
        'id',
        'participant_id',
        'source_progress_id',
        'distance',
        'created_at',
        'updated_at',
      ]);

      const participantFks = legacy.prepare(
        'PRAGMA foreign_key_list(event_participants)',
      ).all() as Array<{ table: string }>;
      expect(participantFks.map((fk) => fk.table)).toContain('encounter_occurrences');
      expect(
        (legacy.prepare('SELECT COUNT(*) AS count FROM event_participants').get() as { count: number }).count,
      ).toBe(0);

      // The old prototype had only two occurrence ids; a third accept must work.
      for (let index = 1; index <= 3; index += 1) {
        legacy.exec(`INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-1${index}')`);
        legacy.exec(
          `INSERT INTO encounter_occurrences
             (definition_id, user_id, daily_roll_id, personalized_target, started_at, coverage_end_date, grace_deadline)
           VALUES (1, 1, ${index}, 10.0, '2026-06-10', '2026-06-12', '2026-06-15')`,
        );
      }
      legacy.exec('INSERT INTO event_participants (occurrence_id, user_id) VALUES (3, 1)');

      expect(
        (legacy.prepare('SELECT COUNT(*) AS count FROM event_participants').get() as { count: number }).count,
      ).toBe(1);
    } finally {
      legacy.close();
    }
  });

  it('rejects duplicate definition slugs', () => {    expect(() =>
      sqlite.exec(
        `INSERT INTO personal_encounter_definitions
           (slug, name, description, duration_days)
         VALUES ('nazgul-pursuit', 'Duplicate', 'Duplicate', 3)`,
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('enforces one daily roll per user per date', () => {
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec(
      "INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-10')",
    );

    expect(() =>
      sqlite.exec(
        "INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-10')",
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('enforces one occurrence per daily roll and one participant per occurrence', () => {
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec("INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-10')");
    sqlite.exec(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, personalized_target, started_at, coverage_end_date, grace_deadline)
       VALUES (1, 1, 1, 10.0, '2026-06-10', '2026-06-12', '2026-06-15')`,
    );
    sqlite.exec(
      "INSERT INTO event_participants (occurrence_id, user_id) VALUES (1, 1)",
    );

    expect(() =>
      sqlite.exec(
        `INSERT INTO encounter_occurrences
           (definition_id, user_id, daily_roll_id, personalized_target, started_at, coverage_end_date, grace_deadline)
         VALUES (1, 1, 1, 10.0, '2026-06-10', '2026-06-12', '2026-06-15')`,
      ),
    ).toThrow(/UNIQUE constraint/);

    expect(() =>
      sqlite.exec(
        "INSERT INTO event_participants (occurrence_id, user_id) VALUES (1, 1)",
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('enforces one ledger entry per participant and source progress row', () => {
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec("INSERT INTO progress (date, distance, user_id) VALUES ('2026-06-10', 5.0, 1)");
    sqlite.exec("INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-10')");
    sqlite.exec(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, personalized_target, started_at, coverage_end_date, grace_deadline)
       VALUES (1, 1, 1, 10.0, '2026-06-10', '2026-06-12', '2026-06-15')`,
    );
    sqlite.exec("INSERT INTO event_participants (occurrence_id, user_id) VALUES (1, 1)");
    sqlite.exec(
      'INSERT INTO event_progress_ledger (participant_id, source_progress_id, distance) VALUES (1, 1, 5.0)',
    );

    expect(() =>
      sqlite.exec(
        'INSERT INTO event_progress_ledger (participant_id, source_progress_id, distance) VALUES (1, 1, 5.0)',
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('cascades user deletion through rolls, occurrences, participants, and ledger rows', () => {
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec("INSERT INTO progress (date, distance, user_id) VALUES ('2026-06-10', 5.0, 1)");
    sqlite.exec("INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-10')");
    sqlite.exec(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, personalized_target, started_at, coverage_end_date, grace_deadline)
       VALUES (1, 1, 1, 10.0, '2026-06-10', '2026-06-12', '2026-06-15')`,
    );
    sqlite.exec("INSERT INTO event_participants (occurrence_id, user_id) VALUES (1, 1)");
    sqlite.exec(
      'INSERT INTO event_progress_ledger (participant_id, source_progress_id, distance) VALUES (1, 1, 5.0)',
    );

    sqlite.exec('DELETE FROM users WHERE id = 1');

    for (const table of [
      'daily_rolls',
      'encounter_occurrences',
      'event_participants',
      'event_progress_ledger',
    ]) {
      const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
      expect(row.count).toBe(0);
    }
  });

  it('cascades occurrence deletion to participants and ledger rows', () => {
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec("INSERT INTO progress (date, distance, user_id) VALUES ('2026-06-10', 5.0, 1)");
    sqlite.exec("INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-10')");
    sqlite.exec(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, personalized_target, started_at, coverage_end_date, grace_deadline)
       VALUES (1, 1, 1, 10.0, '2026-06-10', '2026-06-12', '2026-06-15')`,
    );
    sqlite.exec("INSERT INTO event_participants (occurrence_id, user_id) VALUES (1, 1)");
    sqlite.exec(
      'INSERT INTO event_progress_ledger (participant_id, source_progress_id, distance) VALUES (1, 1, 5.0)',
    );

    sqlite.exec('DELETE FROM encounter_occurrences WHERE id = 1');

    expect(
      (sqlite.prepare('SELECT COUNT(*) AS count FROM event_participants').get() as { count: number }).count,
    ).toBe(0);
    expect(
      (sqlite.prepare('SELECT COUNT(*) AS count FROM event_progress_ledger').get() as { count: number }).count,
    ).toBe(0);
  });

  it('cascades ledger rows when the source progress row is deleted', () => {
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec("INSERT INTO progress (date, distance, user_id) VALUES ('2026-06-10', 5.0, 1)");
    sqlite.exec("INSERT INTO daily_rolls (user_id, roll_date) VALUES (1, '2026-06-10')");
    sqlite.exec(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, personalized_target, started_at, coverage_end_date, grace_deadline)
       VALUES (1, 1, 1, 10.0, '2026-06-10', '2026-06-12', '2026-06-15')`,
    );
    sqlite.exec("INSERT INTO event_participants (occurrence_id, user_id) VALUES (1, 1)");
    sqlite.exec(
      'INSERT INTO event_progress_ledger (participant_id, source_progress_id, distance) VALUES (1, 1, 5.0)',
    );

    sqlite.exec('DELETE FROM progress WHERE id = 1');

    expect(
      (sqlite.prepare('SELECT COUNT(*) AS count FROM event_progress_ledger').get() as { count: number }).count,
    ).toBe(0);
  });
});
