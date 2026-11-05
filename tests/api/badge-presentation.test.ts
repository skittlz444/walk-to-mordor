import {
  parseBadgeMetadata,
  resolveBadgePresentation,
  resolveBadgeRank,
} from '../../src/badge-presentation';

const THRESHOLDS = [1, 4, 12, 26];

function metadataJson(value: unknown): string {
  return JSON.stringify(value);
}

describe('Badge presentation', () => {
  describe('parseBadgeMetadata', () => {
    it('returns an empty object for null, empty, malformed, and non-object JSON', () => {
      expect(parseBadgeMetadata(null)).toEqual({});
      expect(parseBadgeMetadata(undefined)).toEqual({});
      expect(parseBadgeMetadata('')).toEqual({});
      expect(parseBadgeMetadata('not json')).toEqual({});
      expect(parseBadgeMetadata('"a string"')).toEqual({});
      expect(parseBadgeMetadata('42')).toEqual({});
      expect(parseBadgeMetadata('null')).toEqual({});
      expect(parseBadgeMetadata('[]')).toEqual({});
    });

    it('accepts a fixed rank from 1 to 4', () => {
      for (const rank of [1, 2, 3, 4]) {
        expect(parseBadgeMetadata(metadataJson({ rank }))).toEqual({ rank });
      }
    });

    it('treats out-of-range, non-integer, and non-numeric ranks as absent', () => {
      for (const rank of [0, 5, -1, 2.5, '3', null, true]) {
        expect(parseBadgeMetadata(metadataJson({ rank }))).toEqual({});
      }
    });

    it('accepts four strictly ascending rank thresholds', () => {
      expect(parseBadgeMetadata(metadataJson({ rank_thresholds: THRESHOLDS }))).toEqual({
        rank_thresholds: THRESHOLDS,
      });
    });

    it('rejects threshold arrays that are not four positive ascending numbers', () => {
      const invalid = [
        [1, 4, 12],
        [1, 4, 12, 26, 40],
        [1, 4, 12, 12],
        [1, 4, 12, 26.5],
        [0, 4, 12, 26],
        [-1, 4, 12, 26],
        [1, 4, '12', 26],
        [1, 4, 12, null],
        'not-an-array',
      ];

      for (const rank_thresholds of invalid) {
        expect(parseBadgeMetadata(metadataJson({ rank_thresholds }))).toEqual({});
      }
    });

    it('accepts a valid collection', () => {
      const collection = {
        slug: 'frodo-sam-journey',
        label: 'The Road to Mordor',
        index: 7,
        size: 8,
      };
      expect(parseBadgeMetadata(metadataJson({ collection }))).toEqual({ collection });
    });

    it('rejects collections with missing, wrong-typed, or out-of-range fields', () => {
      const invalid = [
        { slug: 'frodo-sam-journey', label: 'The Road to Mordor', index: 7 },
        { slug: '', label: 'The Road to Mordor', index: 7, size: 8 },
        { slug: 'frodo-sam-journey', label: '   ', index: 7, size: 8 },
        { slug: 7, label: 'The Road to Mordor', index: 7, size: 8 },
        { slug: 'frodo-sam-journey', label: 'The Road to Mordor', index: 0, size: 8 },
        { slug: 'frodo-sam-journey', label: 'The Road to Mordor', index: 1.5, size: 8 },
        { slug: 'frodo-sam-journey', label: 'The Road to Mordor', index: 9, size: 8 },
        { slug: 'frodo-sam-journey', label: 'The Road to Mordor', index: 7, size: 0 },
        { slug: 'frodo-sam-journey', label: 'The Road to Mordor', index: '7', size: 8 },
        'not-an-object',
      ];

      for (const collection of invalid) {
        expect(parseBadgeMetadata(metadataJson({ collection }))).toEqual({});
      }
    });

    it('accepts a non-empty storyline and ignores empty or non-string values', () => {
      expect(parseBadgeMetadata(metadataJson({ storyline: 'frodo-sam' }))).toEqual({
        storyline: 'frodo-sam',
      });
      expect(parseBadgeMetadata(metadataJson({ storyline: '' }))).toEqual({});
      expect(parseBadgeMetadata(metadataJson({ storyline: '   ' }))).toEqual({});
      expect(parseBadgeMetadata(metadataJson({ storyline: 7 }))).toEqual({});
    });
  });

  describe('resolveBadgeRank', () => {
    it('returns a fixed rank regardless of earned count', () => {
      expect(resolveBadgeRank({ rank: 3 }, 0)).toBe(3);
      expect(resolveBadgeRank({ rank: 3 }, 500)).toBe(3);
    });

    it('prefers a fixed rank over thresholds', () => {
      expect(resolveBadgeRank({ rank: 1, rank_thresholds: THRESHOLDS }, 26)).toBe(1);
    });

    it('keeps rank 1 below the first threshold', () => {
      expect(resolveBadgeRank({ rank_thresholds: [2, 4, 12, 26] }, 0)).toBe(1);
      expect(resolveBadgeRank({ rank_thresholds: [2, 4, 12, 26] }, 1)).toBe(1);
    });

    it('counts exact threshold boundaries', () => {
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 1)).toBe(1);
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 4)).toBe(2);
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 12)).toBe(3);
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 26)).toBe(4);
    });

    it('raises rank between thresholds', () => {
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 3)).toBe(1);
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 5)).toBe(2);
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 13)).toBe(3);
    });

    it('caps at rank 4 above the last threshold', () => {
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 27)).toBe(4);
      expect(resolveBadgeRank({ rank_thresholds: THRESHOLDS }, 1000)).toBe(4);
    });

    it('defaults to rank 1 without usable metadata', () => {
      expect(resolveBadgeRank(null, 10)).toBe(1);
      expect(resolveBadgeRank({}, 10)).toBe(1);
      expect(resolveBadgeRank('not json', 10)).toBe(1);
      expect(resolveBadgeRank(metadataJson({ rank: 9 }), 10)).toBe(1);
    });

    it('accepts raw metadata JSON', () => {
      expect(resolveBadgeRank(metadataJson({ rank_thresholds: THRESHOLDS }), 5)).toBe(2);
    });
  });

  describe('resolveBadgePresentation', () => {
    it('maps ranks to their labels', () => {
      expect(resolveBadgePresentation(metadataJson({ rank: 1 }), 1).rank_label).toBe('bronze');
      expect(resolveBadgePresentation(metadataJson({ rank: 2 }), 1).rank_label).toBe('silver');
      expect(resolveBadgePresentation(metadataJson({ rank: 3 }), 1).rank_label).toBe('gold');
      expect(resolveBadgePresentation(metadataJson({ rank: 4 }), 1).rank_label).toBe('mithril');
    });

    it('returns rank, storyline, and collection together', () => {
      const metadata = {
        rank: 4,
        storyline: 'frodo-sam',
        collection: {
          slug: 'frodo-sam-journey',
          label: 'The Road to Mordor',
          index: 7,
          size: 8,
        },
      };

      expect(resolveBadgePresentation(metadataJson(metadata), 1)).toEqual({
        rank: 4,
        rank_label: 'mithril',
        storyline: 'frodo-sam',
        collection: metadata.collection,
      });
    });

    it('derives rank from thresholds and repeat count', () => {
      expect(
        resolveBadgePresentation(metadataJson({ rank_thresholds: THRESHOLDS }), 5),
      ).toEqual({
        rank: 2,
        rank_label: 'silver',
        storyline: null,
        collection: null,
      });
    });

    it('resolves the seeded Nazgul badge ranks at its completion thresholds', () => {
      const metadata = '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"pursuits","criteria":"personal_encounter_completed"}';

      expect(resolveBadgePresentation(metadata, 1).rank_label).toBe('bronze');
      expect(resolveBadgePresentation(metadata, 3).rank_label).toBe('silver');
      expect(resolveBadgePresentation(metadata, 4).rank_label).toBe('silver');
      expect(resolveBadgePresentation(metadata, 7).rank_label).toBe('gold');
      expect(resolveBadgePresentation(metadata, 15).rank_label).toBe('mithril');
    });

    it('falls back safely for null, malformed, and out-of-range metadata', () => {
      const fallback = {
        rank: 1,
        rank_label: 'bronze',
        storyline: null,
        collection: null,
      };

      expect(resolveBadgePresentation(null, 5)).toEqual(fallback);
      expect(resolveBadgePresentation('not json', 5)).toEqual(fallback);
      expect(resolveBadgePresentation('[]', 5)).toEqual(fallback);
      expect(
        resolveBadgePresentation(
          metadataJson({ rank: 9, storyline: 7, collection: { slug: 'x', label: 'y', index: 9, size: 8 } }),
          5,
        ),
      ).toEqual(fallback);
    });

    it('honours a global badge with no storyline', () => {
      expect(resolveBadgePresentation(metadataJson({ rank: 1 }), 1)).toEqual({
        rank: 1,
        rank_label: 'bronze',
        storyline: null,
        collection: null,
      });
    });
  });
});
