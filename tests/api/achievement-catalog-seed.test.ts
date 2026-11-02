import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const JOURNEY_SLUGS = [
  'journey-frodo-sam-buckleberry-ferry',
  'journey-frodo-sam-weathertop-survivor',
  'journey-frodo-sam-through-khazad-dum',
  'journey-frodo-sam-lothlorien-guest',
  'journey-frodo-sam-rauros-parting',
  'journey-frodo-sam-mordor-threshold',
  'journey-frodo-sam-glittering-caves',
  'journey-frodo-sam-home-at-sunset',
];

const EXPANSION_SLUGS = [
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
  threshold_km?: number;
  collection?: CollectionMetadata;
}

interface SeedRun {
  firstPassCount: number;
  secondPassCount: number;
  rows: SeedRow[];
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function countDefinitions(db: DatabaseSync): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM achievement_definitions')
    .get() as { count: number };
  return row.count;
}

function applyCatalogSeedsTwice(): SeedRun {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readMigration('0142_create_achievement_definitions.sql'));

    const seeds = [
      readMigration('0144_seed_journey_badges.sql'),
      readMigration('0145_seed_catalog_expansion.sql'),
      readMigration('0146_update_faithful_walker_description.sql'),
    ];

    for (const seed of seeds) {
      db.exec(seed);
    }
    const firstPassCount = countDefinitions(db);

    for (const seed of seeds) {
      db.exec(seed);
    }
    const secondPassCount = countDefinitions(db);

    const rows = db
      .prepare(
        `SELECT slug, name, description, image_slug, badge_type, is_repeatable, metadata
         FROM achievement_definitions
         ORDER BY slug`,
      )
      .all() as unknown as SeedRow[];

    return { firstPassCount, secondPassCount, rows };
  } finally {
    db.close();
  }
}

describe('achievement catalog seed (0144 + 0145 + 0146)', () => {
  let run: SeedRun;
  let rows: SeedRow[];
  let bySlug: Map<string, SeedRow>;

  beforeAll(() => {
    run = applyCatalogSeedsTwice();
    rows = run.rows;
    bySlug = new Map(rows.map((row) => [row.slug, row]));
  });

  function metadataFor(slug: string): CatalogMetadata {
    const row = bySlug.get(slug);
    if (!row) throw new Error(`missing seeded definition: ${slug}`);
    return JSON.parse(row.metadata) as CatalogMetadata;
  }

  it('seeds exactly fifteen definitions when both migrations are applied twice', () => {
    expect(run.firstPassCount).toBe(15);
    expect(run.secondPassCount).toBe(15);
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(15);
    for (const row of rows) {
      expect(() => JSON.parse(row.metadata)).not.toThrow();
      expect(row.image_slug).toBe(row.slug);
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.description.length).toBeGreaterThan(0);
    }
  });

  it('splits into eight journey, five habit, and two community definitions', () => {
    const byType = (type: string) => rows.filter((row) => row.badge_type === type);

    expect(byType('journey')).toHaveLength(8);
    expect(byType('habit')).toHaveLength(5);
    expect(byType('community')).toHaveLength(2);
    expect(byType('journey').every((row) => row.is_repeatable === 0)).toBe(true);
    expect(byType('community').every((row) => row.is_repeatable === 0)).toBe(true);
  });

  it('orders the journey collection 1-8 with Glittering Caves seventh and Home eighth', () => {
    const journey = rows
      .filter((row) => row.badge_type === 'journey')
      .map((row) => ({ slug: row.slug, collection: metadataFor(row.slug).collection }))
      .sort((a, b) => (a.collection?.index ?? 0) - (b.collection?.index ?? 0));

    expect(journey.map((entry) => entry.slug)).toEqual(JOURNEY_SLUGS);
    expect(journey.map((entry) => entry.collection?.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(journey.every((entry) => entry.collection?.size === 8)).toBe(true);
    expect(journey.every((entry) => entry.collection?.slug === 'frodo-sam-journey')).toBe(true);
    expect(journey.every((entry) => entry.collection?.label === 'The Road to Mordor')).toBe(true);
    expect(journey[6]?.slug).toBe('journey-frodo-sam-glittering-caves');
    expect(journey[7]?.slug).toBe('journey-frodo-sam-home-at-sunset');
  });

  it('stores the journey storyline, fixed ranks, and thresholds in order', () => {
    const expected = [
      { slug: JOURNEY_SLUGS[0], rank: 1, thresholdKm: 112.65 },
      { slug: JOURNEY_SLUGS[1], rank: 1, thresholdKm: 387.85 },
      { slug: JOURNEY_SLUGS[2], rank: 2, thresholdKm: 1284.25 },
      { slug: JOURNEY_SLUGS[3], rank: 2, thresholdKm: 1375.98 },
      { slug: JOURNEY_SLUGS[4], rank: 3, thresholdKm: 2106.63 },
      { slug: JOURNEY_SLUGS[5], rank: 3, thresholdKm: 2863.01 },
      { slug: JOURNEY_SLUGS[6], rank: 4, thresholdKm: 3827.0 },
      { slug: JOURNEY_SLUGS[7], rank: 4, thresholdKm: 6422.49 },
    ];

    for (const entry of expected) {
      expect(metadataFor(entry.slug)).toMatchObject({
        storyline: 'frodo-sam',
        rank: entry.rank,
        threshold_km: entry.thresholdKm,
      });
    }
  });

  it('stores the Glittering Caves return badge at 3827.0 km and rank 4', () => {
    const metadata = metadataFor('journey-frodo-sam-glittering-caves');

    expect(metadata).toMatchObject({
      storyline: 'frodo-sam',
      rank: 4,
      threshold_km: 3827.0,
      criteria: 'distance_km >= 3827.0',
      collection: {
        slug: 'frodo-sam-journey',
        label: 'The Road to Mordor',
        index: 7,
        size: 8,
      },
    });
    expect(metadata.rank_thresholds).toBeUndefined();
  });

  it('keeps all five catalog-expansion rows', () => {
    for (const slug of EXPANSION_SLUGS) {
      expect(bySlug.has(slug)).toBe(true);
    }
    expect(
      EXPANSION_SLUGS.filter((slug) => bySlug.get(slug)?.badge_type === 'community'),
    ).toHaveLength(2);
    expect(
      EXPANSION_SLUGS.filter((slug) => bySlug.get(slug)?.badge_type === 'habit'),
    ).toHaveLength(3);
  });

  it('seeds the two global habit badges', () => {
    const firstSteps = metadataFor('habit-first-steps');
    const faithfulWalker = metadataFor('habit-faithful-walker');

    expect(bySlug.get('habit-first-steps')?.is_repeatable).toBe(0);
    expect(firstSteps).toMatchObject({ storyline: null, rank: 1, criteria: 'first_walk' });
    expect(firstSteps.collection).toBeUndefined();
    expect(firstSteps.threshold_km).toBeUndefined();

    expect(bySlug.get('habit-faithful-walker')?.is_repeatable).toBe(1);
    expect(bySlug.get('habit-faithful-walker')?.description).toContain('calendar week');
    expect(faithfulWalker).toMatchObject({
      storyline: null,
      rank_thresholds: [1, 4, 12, 26],
      criteria: 'seven_day_streak',
      unit: 'weeks',
    });
    expect(faithfulWalker.rank).toBeUndefined();
    expect(faithfulWalker.collection).toBeUndefined();
  });

  it('updates the old Faithful Walker description on existing databases', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(readMigration('0142_create_achievement_definitions.sql'));
      db.exec(readMigration('0144_seed_journey_badges.sql'));
      db.exec(`
        UPDATE achievement_definitions
        SET description = 'Walk on seven distinct days within a trailing seven-day window.'
        WHERE slug = 'habit-faithful-walker'
      `);

      db.exec(readMigration('0146_update_faithful_walker_description.sql'));

      const row = db
        .prepare('SELECT description FROM achievement_definitions WHERE slug = ?')
        .get('habit-faithful-walker') as { description: string };
      expect(row.description).toContain('calendar week');
    } finally {
      db.close();
    }
  });
});
