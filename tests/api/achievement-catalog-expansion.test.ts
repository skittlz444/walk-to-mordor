import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const HUNDRED_WEEK_DESCRIPTION = 'Log at least 100 km within a Monday–Sunday calendar week.';

const SEEDED_SLUGS = [
  'community-fellowship-founder',
  'community-good-company',
  'habit-hundred-week',
  'habit-steady-month',
  'habit-weekend-warrior',
];

interface SeedRow {
  slug: string;
  name: string;
  description: string;
  image_slug: string;
  badge_type: string;
  is_repeatable: number;
  metadata: string;
}

interface CollectionMetadata {
  slug: string;
  label: string;
  index: number;
  size: number;
}

interface CatalogMetadata {
  storyline: string | null;
  criteria: string;
  unit?: string;
  rank?: number;
  rank_thresholds?: number[];
  collection?: CollectionMetadata;
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function applyCatalogSeedTwice(): SeedRow[] {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readMigration('0142_create_achievement_definitions.sql'));
    const seed = readMigration('0145_seed_catalog_expansion.sql');
    db.exec(seed);
    db.exec(seed);

    return db
      .prepare(
        `SELECT slug, name, description, image_slug, badge_type, is_repeatable, metadata
         FROM achievement_definitions
         ORDER BY slug`,
      )
      .all() as unknown as SeedRow[];
  } finally {
    db.close();
  }
}

interface DescriptionRow {
  slug: string;
  description: string | null;
  metadata: string | null;
  updated_at: string;
}

function descriptionRows(sqlite: DatabaseSync): Map<string, DescriptionRow> {
  const rows = sqlite
    .prepare(
      `SELECT slug, description, metadata, updated_at
       FROM achievement_definitions
       ORDER BY slug`,
    )
    .all() as unknown as DescriptionRow[];
  return new Map(rows.map((row) => [row.slug, row]));
}

describe('achievement catalog expansion seed (0145)', () => {
  let rows: SeedRow[];
  let bySlug: Map<string, SeedRow>;

  beforeAll(() => {
    rows = applyCatalogSeedTwice();
    bySlug = new Map(rows.map((row) => [row.slug, row]));
  });

  function metadataFor(slug: string): CatalogMetadata {
    const row = bySlug.get(slug);
    if (!row) throw new Error(`missing seeded definition: ${slug}`);
    return JSON.parse(row.metadata) as CatalogMetadata;
  }

  it('seeds exactly five definitions when applied twice', () => {
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(5);
    for (const row of rows) {
      expect(() => JSON.parse(row.metadata)).not.toThrow();
    }
  });

  it('uses unique slugs that stay inside this change’s ownership', () => {
    expect(rows.map((row) => row.slug)).toEqual(SEEDED_SLUGS);
    for (const slug of SEEDED_SLUGS) {
      expect(slug).not.toMatch(/^(journey|book|challenge|field-guide|campaign)-/);
    }
    expect(SEEDED_SLUGS).not.toContain('habit-first-steps');
    expect(SEEDED_SLUGS).not.toContain('habit-faithful-walker');
  });

  it('seeds three repeatable habit badges and two non-repeatable community badges', () => {
    const habit = rows.filter((row) => row.badge_type === 'habit');
    const community = rows.filter((row) => row.badge_type === 'community');

    expect(habit).toHaveLength(3);
    expect(community).toHaveLength(2);
    expect(habit.every((row) => row.is_repeatable === 1)).toBe(true);
    expect(community.every((row) => row.is_repeatable === 0)).toBe(true);

    for (const row of rows) {
      expect(row.image_slug).toBe(row.slug);
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.description.length).toBeGreaterThan(0);
      expect(metadataFor(row.slug).storyline).toBeNull();
    }
  });

  it('stores the habit criteria, units, and rank thresholds', () => {
    const expected = {
      'habit-weekend-warrior': {
        criteria: 'weekend_both_days',
        unit: 'weekends',
        rank_thresholds: [1, 4, 12, 26],
      },
      'habit-steady-month': {
        criteria: 'distinct_days_month >= 20',
        unit: 'months',
        rank_thresholds: [1, 3, 6, 12],
      },
      'habit-hundred-week': {
        criteria: 'trailing_7d_km >= 100',
        unit: 'weeks',
        rank_thresholds: [1, 4, 12, 26],
      },
    } as const;

    for (const [slug, values] of Object.entries(expected)) {
      expect(metadataFor(slug)).toMatchObject(values);
      expect(metadataFor(slug).rank).toBeUndefined();
      expect(metadataFor(slug).collection).toBeUndefined();
    }
  });

  it('stores the community fellowship collection positions and criteria', () => {
    const expected = {
      'community-fellowship-founder': {
        rank: 1,
        criteria: 'party_created',
        collection: {
          slug: 'community-fellowship',
          label: 'The Fellowship',
          index: 1,
          size: 2,
        },
      },
      'community-good-company': {
        rank: 2,
        criteria: 'party_active_members >= 4',
        collection: {
          slug: 'community-fellowship',
          label: 'The Fellowship',
          index: 2,
          size: 2,
        },
      },
    } as const;

    for (const [slug, values] of Object.entries(expected)) {
      expect(metadataFor(slug)).toMatchObject(values);
      expect(metadataFor(slug).rank_thresholds).toBeUndefined();
      expect(metadataFor(slug).unit).toBeUndefined();
    }
  });
});

describe('hundred-week description correction (0149)', () => {
  let sqlite: DatabaseSync;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0145_seed_catalog_expansion.sql'));
  });

  afterEach(() => {
    sqlite.close();
  });

  it('rewrites only the seeded trailing-window description and keeps metadata', () => {
    const before = descriptionRows(sqlite);

    sqlite.exec(readMigration('0149_update_hundred_week_description.sql'));

    const after = descriptionRows(sqlite);
    expect(after.size).toBe(before.size);
    expect(after.get('habit-hundred-week')?.description).toBe(HUNDRED_WEEK_DESCRIPTION);
    expect(after.get('habit-hundred-week')?.metadata).toBe(
      before.get('habit-hundred-week')?.metadata,
    );

    for (const slug of SEEDED_SLUGS) {
      if (slug === 'habit-hundred-week') continue;
      expect(after.get(slug)).toEqual(before.get(slug));
    }
  });

  it('is a no-op when applied a second time', () => {
    const migration = readMigration('0149_update_hundred_week_description.sql');
    sqlite.exec(migration);
    const once = descriptionRows(sqlite).get('habit-hundred-week');

    expect(() => sqlite.exec(migration)).not.toThrow();
    expect(descriptionRows(sqlite).get('habit-hundred-week')).toEqual(once);
  });

  it('leaves a description that no longer matches the old text untouched', () => {
    sqlite
      .prepare(
        `UPDATE achievement_definitions
         SET description = 'Custom local wording.'
         WHERE slug = 'habit-hundred-week'`,
      )
      .run();

    sqlite.exec(readMigration('0149_update_hundred_week_description.sql'));

    expect(descriptionRows(sqlite).get('habit-hundred-week')?.description).toBe(
      'Custom local wording.',
    );
  });
});
