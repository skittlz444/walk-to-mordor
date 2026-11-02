import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const MINIMAL_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE
);
`;

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

interface TableInfoRow {
  name: string;
}

function tableColumns(sqlite: DatabaseSync, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as TableInfoRow[];
  return rows.map((row) => row.name);
}

describe('user_achievement_acknowledgements migration', () => {
  let sqlite: DatabaseSync;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(MINIMAL_SCHEMA);
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
  });

  afterEach(() => {
    sqlite.close();
  });

  it('creates the acknowledgements table keyed by user and instance', () => {
    sqlite.exec(readMigration('0147_create_user_achievement_acknowledgements.sql'));

    const table = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('user_achievement_acknowledgements') as { name: string } | undefined;

    expect(table?.name).toBe('user_achievement_acknowledgements');
    expect(tableColumns(sqlite, 'user_achievement_acknowledgements')).toEqual([
      'user_id',
      'instance_id',
      'acknowledged_at',
    ]);
  });

  it('is a no-op when the full chain is applied twice', () => {
    const chain = [
      readMigration('0142_create_achievement_definitions.sql'),
      readMigration('0143_create_user_achievement_instances.sql'),
      readMigration('0147_create_user_achievement_acknowledgements.sql'),
    ];

    for (const migration of chain) sqlite.exec(migration);
    const columnsAfterFirst = tableColumns(sqlite, 'user_achievement_acknowledgements');
    const instanceColumnsAfterFirst = tableColumns(sqlite, 'user_achievement_instances');

    expect(() => {
      for (const migration of chain) sqlite.exec(migration);
    }).not.toThrow();

    expect(tableColumns(sqlite, 'user_achievement_acknowledgements')).toEqual(columnsAfterFirst);
    expect(tableColumns(sqlite, 'user_achievement_instances')).toEqual(instanceColumnsAfterFirst);
  });

  it('leaves the earned-instance table columns unchanged', () => {
    const before = tableColumns(sqlite, 'user_achievement_instances');

    sqlite.exec(readMigration('0147_create_user_achievement_acknowledgements.sql'));

    expect(tableColumns(sqlite, 'user_achievement_instances')).toEqual(before);
  });

  it('enforces one acknowledgement per user per instance', () => {
    sqlite.exec(readMigration('0147_create_user_achievement_acknowledgements.sql'));
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec(
      `INSERT INTO achievement_definitions (slug, name, badge_type)
       VALUES ('habit-first-steps', 'First Steps', 'habit')`,
    );
    sqlite.exec(
      `INSERT INTO user_achievement_instances (user_id, achievement_id, idempotency_key)
       VALUES (1, 1, 'first-steps')`,
    );
    sqlite.exec(
      `INSERT INTO user_achievement_acknowledgements (user_id, instance_id) VALUES (1, 1)`,
    );

    expect(() =>
      sqlite.exec(
        `INSERT INTO user_achievement_acknowledgements (user_id, instance_id) VALUES (1, 1)`,
      ),
    ).toThrow(/UNIQUE constraint/);
  });

  it('cascades acknowledgements when the user is deleted', () => {
    sqlite.exec(readMigration('0147_create_user_achievement_acknowledgements.sql'));
    sqlite.exec("INSERT INTO users (username) VALUES ('frodo')");
    sqlite.exec(
      `INSERT INTO achievement_definitions (slug, name, badge_type)
       VALUES ('habit-first-steps', 'First Steps', 'habit')`,
    );
    sqlite.exec(
      `INSERT INTO user_achievement_instances (user_id, achievement_id, idempotency_key)
       VALUES (1, 1, 'first-steps')`,
    );
    sqlite.exec(
      `INSERT INTO user_achievement_acknowledgements (user_id, instance_id) VALUES (1, 1)`,
    );

    sqlite.exec('DELETE FROM users WHERE id = 1');

    const row = sqlite
      .prepare('SELECT COUNT(*) AS count FROM user_achievement_acknowledgements')
      .get() as { count: number };
    expect(Number(row.count)).toBe(0);
  });
});
