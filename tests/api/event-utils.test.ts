import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import {
  EncounterConflictError,
  EncounterNotFoundError,
  EncounterValidationError,
  acceptEncounter,
  addDays,
  calculatePreviewTarget,
  declineEncounter,
  evaluateEncounterEligibility,
  getEncounterDefinitionById,
  reconcileProgressForUser,
  rollDailyEncounter,
  settleExpiredChallenges,
  utcToday,
  type PersonalEncounterDefinition,
} from '../../src/event-utils';
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

const EVENT_MIGRATIONS = [
  '0152_create_personal_encounter_definitions.sql',
  '0153_create_encounter_occurrences.sql',
  '0154_create_daily_rolls.sql',
  '0155_create_event_participants.sql',
  '0156_create_event_progress_ledger.sql',
  '0157_seed_nazgul_encounter.sql',
  '0158_seed_nazgul_badge.sql',
];

type SqlValue = string | number | null;

/** Minimal DbClient adapter over an in-memory SQLite database. */
function createDbClient(database: DatabaseSync): DbClient {
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
    async batch(statements: Array<{ run(): Promise<{ meta: { changes: number } }> }>) {
      // D1 batches run sequentially; these synchronous statements do too.
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
  };

  return {
    read: connection as unknown as D1Database,
    write: connection as unknown as D1Database,
  };
}

/** Wrap a DbClient with a write batch that always fails with `error`. */
function withBatchFailure(base: DbClient, error: unknown): DbClient {
  const write = {
    prepare: base.write.prepare.bind(base.write),
    batch: async () => {
      throw error;
    },
  } as unknown as D1Database;
  return { read: base.read, write };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

interface ChallengeOptions {
  userId?: number;
  start?: string;
  target?: number;
  durationDays?: number;
  definitionId?: number;
  status?: 'active' | 'completed' | 'failed';
  progress?: number;
  rollDate?: string;
}

interface ChallengeRowIds {
  rollId: number;
  occurrenceId: number;
  participantId: number;
}

describe('event-utils', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let definition: PersonalEncounterDefinition;

  function insertUser(username: string): number {
    const result = sqlite.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    return Number(result.lastInsertRowid);
  }

  function insertProgress(userId: number, date: string, distance: number): number {
    const result = sqlite
      .prepare('INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)')
      .run(date, distance, userId);
    return Number(result.lastInsertRowid);
  }

  function seedActivity(userId: number, days = 7, distance = 1): void {
    for (let index = 0; index < days; index += 1) {
      insertProgress(userId, addDays(TODAY, -(index + 1)), distance);
    }
  }

  function insertDefinition(overrides: {
    slug: string;
    badgeSlug?: string | null;
    isRepeatable?: boolean;
    enabled?: boolean;
    durationDays?: number;
  }): number {
    const result = sqlite.prepare(
      `INSERT INTO personal_encounter_definitions
         (slug, name, description, image_slug, badge_slug, duration_days,
          target_stretch_multiplier, target_min_distance, target_max_distance,
          is_repeatable, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1.3, 3.0, 50.0, ?, ?)`,
    ).run(
      overrides.slug,
      overrides.slug,
      `${overrides.slug} description`,
      overrides.slug,
      overrides.badgeSlug ?? null,
      overrides.durationDays ?? 3,
      overrides.isRepeatable === false ? 0 : 1,
      overrides.enabled === false ? 0 : 1,
    );
    return Number(result.lastInsertRowid);
  }

  function insertRoll(
    userId: number,
    rollDate: string,
    status: 'offered' | 'accepted' | 'declined',
    encounterDefinitionId: number | null,
    previewTarget: number | null,
  ): number {
    const result = sqlite.prepare(
      `INSERT INTO daily_rolls
         (user_id, roll_date, encounter_definition_id, preview_target_distance, status)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, rollDate, encounterDefinitionId, previewTarget, status);
    return Number(result.lastInsertRowid);
  }

  function createChallenge(options: ChallengeOptions = {}): ChallengeRowIds {
    const userId = options.userId ?? 1;
    const start = options.start ?? TODAY;
    const durationDays = options.durationDays ?? 3;
    const target = options.target ?? 5;
    const definitionId = options.definitionId ?? definition.id;
    const status = options.status ?? 'active';
    const rollDate = options.rollDate ?? addDays(start, -30);

    const rollId = insertRoll(userId, rollDate, 'accepted', definitionId, target);
    const occurrence = sqlite.prepare(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, status, personalized_target,
          started_at, coverage_end_date, grace_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      definitionId,
      userId,
      rollId,
      status,
      target,
      start,
      addDays(start, durationDays - 1),
      addDays(start, durationDays - 1 + 3),
    );
    const occurrenceId = Number(occurrence.lastInsertRowid);
    const participant = sqlite.prepare(
      'INSERT INTO event_participants (occurrence_id, user_id, progress_distance) VALUES (?, ?, ?)',
    ).run(occurrenceId, userId, options.progress ?? 0);

    return { rollId, occurrenceId, participantId: Number(participant.lastInsertRowid) };
  }

  function occurrenceRow(occurrenceId: number): {
    status: string;
    personalized_target: number;
    completed_at: string | null;
    user_id: number;
  } {
    return sqlite.prepare(
      'SELECT status, personalized_target, completed_at, user_id FROM encounter_occurrences WHERE id = ?',
    ).get(occurrenceId) as {
      status: string;
      personalized_target: number;
      completed_at: string | null;
      user_id: number;
    };
  }

  function participantRow(participantId: number): { progress_distance: number } {
    return sqlite.prepare(
      'SELECT progress_distance FROM event_participants WHERE id = ?',
    ).get(participantId) as { progress_distance: number };
  }

  function ledgerRows(participantId: number): Array<{
    source_progress_id: number;
    distance: number;
  }> {
    return sqlite.prepare(
      'SELECT source_progress_id, distance FROM event_progress_ledger WHERE participant_id = ? ORDER BY id',
    ).all(participantId) as Array<{ source_progress_id: number; distance: number }>;
  }

  function badgeCount(userId: number, slug = 'challenge-nazgul-outrun'): number {
    const row = sqlite.prepare(
      `SELECT COUNT(*) AS count
       FROM user_achievement_instances uai
       JOIN achievement_definitions ad ON ad.id = uai.achievement_id
       WHERE uai.user_id = ? AND ad.slug = ?`,
    ).get(userId, slug) as { count: number };
    return row.count;
  }

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
    for (const filename of EVENT_MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }

    db = createDbClient(sqlite);
    insertUser('frodo');
    insertUser('sam');

    definition = getEncounterDefinitionByIdSync();
  });

  // beforeEach cannot be async, so resolve the seeded definition synchronously.
  function getEncounterDefinitionByIdSync(): PersonalEncounterDefinition {
    const row = sqlite.prepare(
      `SELECT id, slug, name, description, image_slug, badge_slug, duration_days,
              target_stretch_multiplier, target_min_distance, target_max_distance,
              is_repeatable, enabled, created_at, updated_at
       FROM personal_encounter_definitions
       WHERE slug = 'nazgul-pursuit'`,
    ).get() as {
      id: number;
      slug: string;
      name: string;
      description: string;
      image_slug: string | null;
      badge_slug: string | null;
      duration_days: number;
      target_stretch_multiplier: number;
      target_min_distance: number;
      target_max_distance: number;
      is_repeatable: number;
      enabled: number;
      created_at: string;
      updated_at: string;
    };
    return {
      ...row,
      is_repeatable: row.is_repeatable === 1,
      enabled: row.enabled === 1,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  // ── Date helpers ─────────────────────────────────────────────────────────

  describe('utcToday and addDays', () => {
    it('formats a UTC date', () => {
      expect(utcToday(new Date('2026-06-10T23:59:59.000Z'))).toBe('2026-06-10');
      expect(utcToday(new Date('2026-06-11T00:00:00.000Z'))).toBe('2026-06-11');
      expect(utcToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('adds and subtracts calendar days across boundaries', () => {
      expect(addDays('2026-06-10', 1)).toBe('2026-06-11');
      expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
      expect(addDays('2026-06-10', 0)).toBe('2026-06-10');
    });
  });

  // ── Definitions ──────────────────────────────────────────────────────────

  describe('getEncounterDefinitionById', () => {
    it('returns a mapped definition', async () => {
      const found = await getEncounterDefinitionById(db, definition.id);
      expect(found).toMatchObject({
        id: definition.id,
        slug: 'nazgul-pursuit',
        name: 'Outrun the Nazgûl',
        image_slug: 'nazgul-pursuit',
        badge_slug: 'challenge-nazgul-outrun',
        duration_days: 3,
        is_repeatable: true,
        enabled: true,
      });
    });

    it('returns null for a missing definition', async () => {
      expect(await getEncounterDefinitionById(db, 999999)).toBeNull();
    });
  });

  // ── Eligibility ──────────────────────────────────────────────────────────

  describe('evaluateEncounterEligibility', () => {
    it('reports no_definition when no definition is enabled', async () => {
      sqlite.exec('UPDATE personal_encounter_definitions SET enabled = 0');

      await expect(evaluateEncounterEligibility(db, 1, TODAY)).resolves.toEqual({
        eligible: false,
        reason: 'no_definition',
        useCooldownBranch: false,
      });
    });

    it('reports insufficient_activity below both thresholds', async () => {
      insertProgress(1, TODAY, 1);
      insertProgress(1, addDays(TODAY, -1), 1);

      await expect(evaluateEncounterEligibility(db, 1, TODAY)).resolves.toEqual({
        eligible: false,
        reason: 'insufficient_activity',
        useCooldownBranch: false,
      });
    });

    it('reports insufficient_activity with six walks in 30 days older than a week', async () => {
      for (let index = 10; index < 16; index += 1) {
        insertProgress(1, addDays(TODAY, -index), 1);
      }

      const result = await evaluateEncounterEligibility(db, 1, TODAY);
      expect(result.reason).toBe('insufficient_activity');
      expect(result.eligible).toBe(false);
    });

    it('is eligible with seven distinct days in 30 even when only two are in the last week', async () => {
      for (let index = 0; index < 7; index += 1) {
        insertProgress(1, addDays(TODAY, -(index * 4)), 1);
      }

      await expect(evaluateEncounterEligibility(db, 1, TODAY)).resolves.toEqual({
        eligible: true,
        reason: 'eligible',
        useCooldownBranch: false,
      });
    });

    it('is eligible with three distinct days in the last week', async () => {
      insertProgress(1, TODAY, 1);
      insertProgress(1, addDays(TODAY, -1), 1);
      insertProgress(1, addDays(TODAY, -2), 1);

      await expect(evaluateEncounterEligibility(db, 1, TODAY)).resolves.toEqual({
        eligible: true,
        reason: 'eligible',
        useCooldownBranch: false,
      });
    });

    it('suppresses an offer while a challenge is active', async () => {
      seedActivity(1);
      createChallenge({ userId: 1 });

      const result = await evaluateEncounterEligibility(db, 1, TODAY);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('active_challenge');
    });

    it('uses the cooldown branch after a decision in the last 30 days', async () => {
      seedActivity(1);
      insertRoll(1, addDays(TODAY, -5), 'accepted', definition.id, 5);

      await expect(evaluateEncounterEligibility(db, 1, TODAY)).resolves.toEqual({
        eligible: true,
        reason: 'eligible',
        useCooldownBranch: true,
      });
    });

    it('ignores decisions older than 30 days when choosing the branch', async () => {
      seedActivity(1);
      insertRoll(1, addDays(TODAY, -31), 'declined', definition.id, 5);

      const result = await evaluateEncounterEligibility(db, 1, TODAY);
      expect(result.eligible).toBe(true);
      expect(result.useCooldownBranch).toBe(false);
    });

    it('excludes a non-repeatable definition the user already completed', async () => {
      sqlite.prepare('UPDATE personal_encounter_definitions SET is_repeatable = 0 WHERE id = ?')
        .run(definition.id);
      createChallenge({ userId: 1, status: 'completed' });

      await expect(evaluateEncounterEligibility(db, 1, TODAY)).resolves.toEqual({
        eligible: false,
        reason: 'no_definition',
        useCooldownBranch: false,
      });
    });

    it('defaults today to the current UTC date', async () => {
      const today = utcToday();
      insertProgress(1, today, 1);
      insertProgress(1, addDays(today, -1), 1);
      insertProgress(1, addDays(today, -2), 1);

      const result = await evaluateEncounterEligibility(db, 1);
      expect(result.eligible).toBe(true);
    });
  });

  // ── Target calculation ───────────────────────────────────────────────────

  describe('calculatePreviewTarget', () => {
    it('clamps to the minimum when the user has no recent walks', async () => {
      expect(await calculatePreviewTarget(db, definition, 1, TODAY)).toBe(3);
    });

    it('uses the average across distinct active days times the stretch factor', async () => {
      insertProgress(1, '2026-06-08', 2);
      insertProgress(1, '2026-06-09', 4);
      insertProgress(1, '2026-06-10', 6);

      expect(await calculatePreviewTarget(db, definition, 1, TODAY)).toBe(5.2);
    });

    it('clamps to the maximum target', async () => {
      insertProgress(1, TODAY, 100);

      expect(await calculatePreviewTarget(db, definition, 1, TODAY)).toBe(50);
    });

    it('clamps low targets to the minimum and rounds to two decimals', async () => {
      insertProgress(1, TODAY, 1);
      expect(await calculatePreviewTarget(db, definition, 1, TODAY)).toBe(3);

      sqlite.exec('DELETE FROM progress');
      insertProgress(1, '2026-06-08', 1);
      insertProgress(1, '2026-06-09', 4);
      insertProgress(1, '2026-06-10', 5);
      expect(await calculatePreviewTarget(db, definition, 1, TODAY)).toBe(4.33);
    });

    it('defaults today to the current UTC date', async () => {
      expect(await calculatePreviewTarget(db, definition, 1)).toBe(3);
    });
  });

  // ── Daily roll ───────────────────────────────────────────────────────────

  describe('rollDailyEncounter', () => {
    it('records a no-offer roll for an inactive user', async () => {
      const result = await rollDailyEncounter(db, 1, {
        today: TODAY,
        random: () => 0,
        forceOffer: true,
      });

      expect(result).toEqual({ offer: null });
      const row = sqlite.prepare(
        'SELECT encounter_definition_id, preview_target_distance FROM daily_rolls WHERE user_id = ?',
      ).get(1) as { encounter_definition_id: number | null; preview_target_distance: number | null };
      expect(row).toEqual({ encounter_definition_id: null, preview_target_distance: null });
    });

    it('offers an eligible encounter within the base probability branch', async () => {
      seedActivity(1);

      const result = await rollDailyEncounter(db, 1, { today: TODAY, random: () => 0.05 });

      expect(result.offer?.status).toBe('offered');
      expect(result.offer?.definition.id).toBe(definition.id);
      expect(result.offer?.target).toBe(3);
      expect(result.offer?.coverageStart).toBe(TODAY);
      expect(result.offer?.coverageEnd).toBe('2026-06-12');
      expect(result.offer?.graceDeadline).toBe('2026-06-15');
    });

    it('returns no offer when the base probability roll misses', async () => {
      seedActivity(1);

      const result = await rollDailyEncounter(db, 1, { today: TODAY, random: () => 0.5 });
      expect(result).toEqual({ offer: null });
    });

    it('does not re-draw after a no-offer roll on the same UTC day', async () => {
      seedActivity(1);

      const first = await rollDailyEncounter(db, 1, { today: TODAY, random: () => 0.5 });
      expect(first).toEqual({ offer: null });

      // A page refresh must not get a second chance at the dice.
      const second = await rollDailyEncounter(db, 1, {
        today: TODAY,
        random: () => 0.01,
        forceOffer: true,
      });
      expect(second).toEqual({ offer: null });

      const count = sqlite.prepare('SELECT COUNT(*) AS count FROM daily_rolls WHERE user_id = ?')
        .get(1) as { count: number };
      expect(count.count).toBe(1);
    });

    it('uses the 1-in-30 cooldown branch after a recent decision', async () => {
      seedActivity(1);
      seedActivity(2);
      insertRoll(1, addDays(TODAY, -5), 'accepted', definition.id, 5);
      insertRoll(2, addDays(TODAY, -5), 'declined', definition.id, 5);

      expect(await rollDailyEncounter(db, 1, { today: TODAY, random: () => 0.05 }))
        .toEqual({ offer: null });
      expect((await rollDailyEncounter(db, 2, { today: TODAY, random: () => 0.01 })).offer)
        .not.toBeNull();
    });

    it('forceOffer bypasses the probability roll', async () => {
      seedActivity(1);

      const result = await rollDailyEncounter(db, 1, {
        today: TODAY,
        random: () => 0.99,
        forceOffer: true,
      });
      expect(result.offer).not.toBeNull();
    });

    it('picks a random definition when several are eligible', async () => {
      const secondId = insertDefinition({ slug: 'moria-chase', isRepeatable: true });
      seedActivity(1);

      const result = await rollDailyEncounter(db, 1, {
        today: TODAY,
        random: () => 0.9,
        forceOffer: true,
      });
      expect(result.offer?.definition.id).toBe(secondId);
    });

    it('returns the stored offer on a repeat call', async () => {
      seedActivity(1);
      const first = await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      const second = await rollDailyEncounter(db, 1, {
        today: TODAY,
        random: () => 0.99,
        forceOffer: false,
      });

      expect(second.offer).toEqual(first.offer);
      const count = sqlite.prepare('SELECT COUNT(*) AS count FROM daily_rolls WHERE user_id = ?')
        .get(1) as { count: number };
      expect(count.count).toBe(1);
    });

    it('returns no offer for an existing declined roll', async () => {
      insertRoll(1, TODAY, 'declined', definition.id, 5);

      expect(await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true }))
        .toEqual({ offer: null });
    });

    it('returns no offer for an existing roll with no definition', async () => {
      insertRoll(1, TODAY, 'offered', null, null);

      expect(await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true }))
        .toEqual({ offer: null });
    });

    it('does not re-draw when an existing offer has no stored preview distance', async () => {
      insertRoll(1, TODAY, 'offered', definition.id, null);

      expect(await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true }))
        .toEqual({ offer: null });
    });

    it('defaults today, random, and forceOffer when options are omitted', async () => {
      expect(await rollDailyEncounter(db, 1)).toEqual({ offer: null });
    });
  });

  // ── Accept ───────────────────────────────────────────────────────────────

  describe('acceptEncounter', () => {
    it.each([0, -1, 1.5, Number.NaN])('rejects invalid definition id %p', async (id) => {
      await expect(acceptEncounter(db, 1, id, { today: TODAY }))
        .rejects.toBeInstanceOf(EncounterValidationError);
      await expect(acceptEncounter(db, 1, id, { today: TODAY }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('rejects acceptance when no roll exists', async () => {
      await expect(acceptEncounter(db, 1, definition.id, { today: TODAY }))
        .rejects.toBeInstanceOf(EncounterNotFoundError);
    });

    it('rejects a definition that does not match the offer', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });

      await expect(acceptEncounter(db, 1, definition.id + 99, { today: TODAY }))
        .rejects.toBeInstanceOf(EncounterConflictError);
    });

    it('rejects acceptance of a declined roll', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      await declineEncounter(db, 1, definition.id, { today: TODAY });

      await expect(acceptEncounter(db, 1, definition.id, { today: TODAY }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('creates the occurrence, participant, and accepted roll atomically', async () => {
      seedActivity(1);
      const roll = await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });

      const result = await acceptEncounter(db, 1, definition.id, { today: TODAY });

      expect(result.alreadyAccepted).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.occurrence.status).toBe('active');
      expect(result.occurrence.personalized_target).toBe(roll.offer?.target);
      expect(result.occurrence.started_at).toBe(TODAY);
      expect(result.occurrence.coverage_end_date).toBe('2026-06-12');
      expect(result.occurrence.grace_deadline).toBe('2026-06-15');

      const rollRow = sqlite.prepare(
        'SELECT status FROM daily_rolls WHERE user_id = ? AND roll_date = ?',
      ).get(1, TODAY) as { status: string };
      expect(rollRow.status).toBe('accepted');

      const participant = sqlite.prepare(
        'SELECT occurrence_id, progress_distance FROM event_participants WHERE user_id = ?',
      ).get(1) as { occurrence_id: number; progress_distance: number };
      expect(participant.occurrence_id).toBe(result.occurrence.id);
      expect(participant.progress_distance).toBe(0);
    });

    it('returns the existing occurrence on repeated accept', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });

      const first = await acceptEncounter(db, 1, definition.id, { today: TODAY });
      const second = await acceptEncounter(db, 1, definition.id, { today: TODAY });

      expect(second.alreadyAccepted).toBe(true);
      expect(second.occurrence.id).toBe(first.occurrence.id);
      const count = sqlite.prepare('SELECT COUNT(*) AS count FROM encounter_occurrences')
        .get() as { count: number };
      expect(count.count).toBe(1);
    });

    it('creates a distinct occurrence for the same definition on a later day', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      const first = await acceptEncounter(db, 1, definition.id, { today: TODAY });

      const nextDay = addDays(TODAY, 1);
      insertRoll(1, nextDay, 'offered', definition.id, 5);
      const second = await acceptEncounter(db, 1, definition.id, { today: nextDay });

      expect(second.alreadyAccepted).toBe(false);
      expect(second.occurrence.id).not.toBe(first.occurrence.id);
      const rows = sqlite.prepare(
        'SELECT id FROM encounter_occurrences WHERE definition_id = ? ORDER BY id',
      ).all(definition.id) as Array<{ id: number }>;
      expect(rows).toHaveLength(2);
    });

    it('recovers from a unique-constraint race on the daily roll', async () => {
      seedActivity(1);
      const roll = await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      const rollId = sqlite.prepare(
        'SELECT id FROM daily_rolls WHERE user_id = ? AND roll_date = ?',
      ).get(1, TODAY) as { id: number };
      const existing = sqlite.prepare(
        `INSERT INTO encounter_occurrences
           (definition_id, user_id, daily_roll_id, status, personalized_target,
            started_at, coverage_end_date, grace_deadline)
         VALUES (?, 1, ?, 'active', ?, ?, '2026-06-12', '2026-06-15')`,
      ).run(definition.id, rollId.id, roll.offer?.target ?? 0, TODAY);

      const result = await acceptEncounter(db, 1, definition.id, { today: TODAY });

      expect(result.alreadyAccepted).toBe(true);
      expect(result.occurrence.id).toBe(Number(existing.lastInsertRowid));
    });

    it('rejects an accepted roll whose occurrence is missing', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      sqlite.prepare('UPDATE daily_rolls SET status = ? WHERE user_id = ? AND roll_date = ?')
        .run('accepted', 1, TODAY);

      await expect(acceptEncounter(db, 1, definition.id, { today: TODAY }))
        .rejects.toBeInstanceOf(EncounterNotFoundError);
    });

    it('rejects acceptance when the definition has been disabled', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      sqlite.prepare('UPDATE personal_encounter_definitions SET enabled = 0 WHERE id = ?')
        .run(definition.id);

      await expect(acceptEncounter(db, 1, definition.id, { today: TODAY }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('computes a target when the roll stored no preview distance', async () => {
      insertRoll(1, TODAY, 'offered', definition.id, null);

      const result = await acceptEncounter(db, 1, definition.id, { today: TODAY });

      expect(result.occurrence.personalized_target).toBe(3);
    });

    it('credits today\'s walk and completes immediately when it meets the target', async () => {
      seedActivity(1, 7, 0.5);
      const roll = await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      expect(roll.offer?.target).toBe(3);
      insertProgress(1, TODAY, 10);

      const result = await acceptEncounter(db, 1, definition.id, { today: TODAY });

      expect(result.completed).toBe(true);
      expect(result.occurrence.status).toBe('completed');
      expect(result.occurrence.completed_at).not.toBeNull();
      expect(participantRow(
        (sqlite.prepare('SELECT id FROM event_participants WHERE user_id = ?').get(1) as { id: number }).id,
      ).progress_distance).toBe(10);
      expect(badgeCount(1)).toBe(1);
    });

    it('defaults today to the current UTC date', async () => {
      const today = utcToday();
      insertRoll(1, today, 'offered', definition.id, 3);

      const result = await acceptEncounter(db, 1, definition.id);

      expect(result.occurrence.started_at).toBe(today);
    });

    it('rejects a missing definition referenced by the roll', async () => {
      sqlite.exec('PRAGMA foreign_keys = OFF;');
      insertRoll(1, TODAY, 'offered', 999999, 3);

      await expect(acceptEncounter(db, 1, 999999, { today: TODAY }))
        .rejects.toBeInstanceOf(EncounterNotFoundError);
    });

    it('rethrows non-unique batch failures', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      sqlite.exec('DROP TABLE event_participants');

      await expect(acceptEncounter(db, 1, definition.id, { today: TODAY }))
        .rejects.toThrow(/no such table: event_participants/);
    });

    it('recognises a unique violation wrapped in an error cause', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      const wrapped = new Error('batch failed');
      wrapped.cause = new Error('UNIQUE constraint failed: encounter_occurrences.daily_roll_id');

      await expect(acceptEncounter(
        withBatchFailure(db, wrapped),
        1,
        definition.id,
        { today: TODAY },
      )).rejects.toBe(wrapped);
    });

    it('recognises a non-Error unique violation', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });

      await expect(acceptEncounter(
        withBatchFailure(db, 'UNIQUE constraint failed'),
        1,
        definition.id,
        { today: TODAY },
      )).rejects.toBe('UNIQUE constraint failed');
    });
  });

  // ── Decline ──────────────────────────────────────────────────────────────

  describe('declineEncounter', () => {
    it('declines today\'s offer and is idempotent', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });

      const first = await declineEncounter(db, 1, definition.id, { today: TODAY });
      const second = await declineEncounter(db, 1, definition.id, { today: TODAY });

      expect(first).toEqual({ declined: true, alreadyDeclined: false });
      expect(second).toEqual({ declined: true, alreadyDeclined: true });
      const row = sqlite.prepare(
        'SELECT status FROM daily_rolls WHERE user_id = ? AND roll_date = ?',
      ).get(1, TODAY) as { status: string };
      expect(row.status).toBe('declined');
    });

    it('rejects a decline when no roll exists', async () => {
      await expect(declineEncounter(db, 1, definition.id, { today: TODAY }))
        .rejects.toBeInstanceOf(EncounterNotFoundError);
    });

    it('rejects a mismatched definition id', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });

      await expect(declineEncounter(db, 1, definition.id + 1, { today: TODAY }))
        .rejects.toBeInstanceOf(EncounterConflictError);
    });

    it('rejects a decline after accepting', async () => {
      seedActivity(1);
      await rollDailyEncounter(db, 1, { today: TODAY, forceOffer: true });
      await acceptEncounter(db, 1, definition.id, { today: TODAY });

      await expect(declineEncounter(db, 1, definition.id, { today: TODAY }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('rejects declining a roll with no offer', async () => {
      insertRoll(1, TODAY, 'offered', null, null);

      await expect(declineEncounter(db, 1, undefined, { today: TODAY }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('defaults today to the current UTC date', async () => {
      const today = utcToday();
      insertRoll(1, today, 'offered', definition.id, 3);

      await expect(declineEncounter(db, 1, definition.id))
        .resolves.toEqual({ declined: true, alreadyDeclined: false });
    });
  });

  // ── Reconciliation ───────────────────────────────────────────────────────

  describe('reconcileProgressForUser', () => {
    it('credits a walk inside the coverage window', async () => {
      const challenge = createChallenge();
      const progressId = insertProgress(1, '2026-06-11', 5);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      });

      expect(ledgerRows(challenge.participantId)).toEqual([
        { source_progress_id: progressId, distance: 5 },
      ]);
      expect(participantRow(challenge.participantId).progress_distance).toBe(5);
    });

    it('credits a coverage-window date logged during the grace period', async () => {
      createChallenge();
      const participantId = (sqlite.prepare(
        'SELECT id FROM event_participants WHERE user_id = ?',
      ).get(1) as { id: number }).id;
      const graceDate = '2026-06-12';
      const progressId = insertProgress(1, graceDate, 4);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: graceDate,
        distance: 4,
        operation: 'upsert',
      });

      expect(participantRow(participantId).progress_distance).toBe(4);
    });

    it('ignores dates before the coverage window', async () => {
      const challenge = createChallenge();
      const progressId = insertProgress(1, '2026-06-09', 5);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-09',
        distance: 5,
        operation: 'upsert',
      });

      expect(ledgerRows(challenge.participantId)).toEqual([]);
      expect(participantRow(challenge.participantId).progress_distance).toBe(0);
    });

    it('ignores dates after the coverage window', async () => {
      const challenge = createChallenge();
      const progressId = insertProgress(1, '2026-06-13', 5);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-13',
        distance: 5,
        operation: 'upsert',
      });

      expect(ledgerRows(challenge.participantId)).toEqual([]);
    });

    it('updates an existing ledger row instead of duplicating it', async () => {
      const challenge = createChallenge({ target: 100 });
      const progressId = insertProgress(1, '2026-06-11', 5);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      });
      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 7,
        operation: 'upsert',
      });

      expect(ledgerRows(challenge.participantId)).toEqual([
        { source_progress_id: progressId, distance: 7 },
      ]);
      expect(participantRow(challenge.participantId).progress_distance).toBe(7);
    });

    it('removes credit when the walk is deleted', async () => {
      const challenge = createChallenge({ target: 100 });
      const progressId = insertProgress(1, '2026-06-11', 5);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      });
      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 0,
        operation: 'delete',
      });

      expect(ledgerRows(challenge.participantId)).toEqual([]);
      expect(participantRow(challenge.participantId).progress_distance).toBe(0);
    });

    it('completes the challenge and awards the badge when the total meets the target', async () => {
      const challenge = createChallenge({ target: 5 });
      const progressId = insertProgress(1, '2026-06-11', 5);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      });

      const row = occurrenceRow(challenge.occurrenceId);
      expect(row.status).toBe('completed');
      expect(row.completed_at).not.toBeNull();
      expect(badgeCount(1)).toBe(1);
    });

    it('completes on a later upward edit of an existing walk', async () => {
      const challenge = createChallenge({ target: 5 });
      const progressId = insertProgress(1, '2026-06-11', 4);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 4,
        operation: 'upsert',
      });
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('active');

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 6,
        operation: 'upsert',
      });
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('completed');
    });

    it('sums multiple credited walks toward the target', async () => {
      const challenge = createChallenge({ target: 8 });
      const firstProgressId = insertProgress(1, '2026-06-10', 3);
      const secondProgressId = insertProgress(1, '2026-06-11', 5);

      await reconcileProgressForUser(db, 1, {
        progressId: firstProgressId,
        date: '2026-06-10',
        distance: 3,
        operation: 'upsert',
      });
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('active');

      await reconcileProgressForUser(db, 1, {
        progressId: secondProgressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      });

      expect(participantRow(challenge.participantId).progress_distance).toBe(8);
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('completed');
      expect(badgeCount(1)).toBe(1);
    });

    it('never revokes an earned badge after a downward edit', async () => {
      const challenge = createChallenge({ target: 5 });
      const progressId = insertProgress(1, '2026-06-11', 6);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 6,
        operation: 'upsert',
      });
      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 2,
        operation: 'upsert',
      });

      expect(occurrenceRow(challenge.occurrenceId).status).toBe('completed');
      expect(badgeCount(1)).toBe(1);
      expect(participantRow(challenge.participantId).progress_distance).toBe(2);
    });

    it('recomputes a completed challenge total when its walk is deleted', async () => {
      const challenge = createChallenge({ target: 5 });
      const progressId = insertProgress(1, '2026-06-11', 6);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 6,
        operation: 'upsert',
      });
      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 0,
        operation: 'delete',
      });

      expect(occurrenceRow(challenge.occurrenceId).status).toBe('completed');
      expect(badgeCount(1)).toBe(1);
      expect(participantRow(challenge.participantId).progress_distance).toBe(0);
    });

    it('does nothing when the user has no active challenges', async () => {
      const progressId = insertProgress(2, '2026-06-11', 5);

      await expect(reconcileProgressForUser(db, 2, {
        progressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      })).resolves.toBeUndefined();
    });

    it('logs and swallows reconciliation failures', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const challenge = createChallenge();
      const progressId = insertProgress(1, '2026-06-11', 5);
      sqlite.exec('DROP TABLE event_progress_ledger');

      await expect(reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      })).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalledWith(
        'Error reconciling personal challenge progress:',
        expect.anything(),
      );
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('active');
    });

    it('skips completion when the definition has no badge_slug', async () => {
      const definitionId = insertDefinition({ slug: 'badgeless', badgeSlug: null });
      const challenge = createChallenge({ definitionId, target: 5 });
      const progressId = insertProgress(1, '2026-06-11', 5);

      await reconcileProgressForUser(db, 1, {
        progressId,
        date: '2026-06-11',
        distance: 5,
        operation: 'upsert',
      });

      expect(occurrenceRow(challenge.occurrenceId).status).toBe('completed');
      expect(badgeCount(1)).toBe(0);
    });
  });

  // ── Settlement ───────────────────────────────────────────────────────────

  describe('settleExpiredChallenges', () => {
    it('does not settle on the grace deadline day itself', async () => {
      const challenge = createChallenge({ start: '2026-06-01', target: 5 });
      expect(addDays('2026-06-01', 5)).toBe('2026-06-06');

      const result = await settleExpiredChallenges(db, { today: '2026-06-06' });

      expect(result).toEqual({ completed: 0, failed: 0 });
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('active');
    });

    it('completes a challenge whose target was met', async () => {
      const challenge = createChallenge({ start: '2026-06-01', target: 5, progress: 6 });

      const result = await settleExpiredChallenges(db, { today: '2026-06-07' });

      expect(result).toEqual({ completed: 1, failed: 0 });
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('completed');
      expect(badgeCount(1)).toBe(1);
    });

    it('fails a challenge whose target was not met', async () => {
      const challenge = createChallenge({ start: '2026-06-01', target: 5, progress: 4 });

      const result = await settleExpiredChallenges(db, { today: '2026-06-07' });

      expect(result).toEqual({ completed: 0, failed: 1 });
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('failed');
      expect(badgeCount(1)).toBe(0);
    });

    it('isolates a settlement error to the affected occurrence', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const badDefinitionId = insertDefinition({
        slug: 'missing-badge-definition',
        badgeSlug: 'missing-badge',
      });
      createChallenge({ start: '2026-06-01', target: 5, progress: 6, definitionId: badDefinitionId });
      const good = createChallenge({
        start: '2026-06-01',
        target: 5,
        progress: 6,
        rollDate: '2026-05-01',
      });

      const result = await settleExpiredChallenges(db, { today: '2026-06-07' });

      expect(consoleError).toHaveBeenCalled();
      expect(occurrenceRow(good.occurrenceId).status).toBe('completed');
      expect(result.completed).toBe(1);
    });

    it('completes a badge-less definition without awarding an achievement', async () => {
      const definitionId = insertDefinition({ slug: 'badgeless-expired', badgeSlug: null });
      const challenge = createChallenge({ start: '2026-06-01', target: 5, progress: 6, definitionId });

      const result = await settleExpiredChallenges(db, { today: '2026-06-07' });

      expect(result).toEqual({ completed: 1, failed: 0 });
      expect(occurrenceRow(challenge.occurrenceId).status).toBe('completed');
      expect(badgeCount(1)).toBe(0);
    });

    it('defaults today to the current UTC date', async () => {
      await expect(settleExpiredChallenges(db)).resolves.toEqual({ completed: 0, failed: 0 });
    });
  });
});
