/**
 * Predefined LOTR-themed avatar inventory.
 *
 * Each slug maps to:
 *   - Full image:  /img/avatars/{slug}.webp
 *   - Thumbnail:   /img/avatars/thumbs/{slug}.webp  (32×32)
 *
 * Avatar assets are repository-backed static files served from public/.
 * Do NOT add user-uploaded avatars or R2 storage — keep this pipeline.
 *
 * NOTE: Placeholder assets are checked in. Replace with real watercolour-style
 * WebP images before shipping the avatar picker UI (Story 6.x).
 */
export const VALID_AVATAR_SLUGS = [
  'anduril',
  'aragorn',
  'arwen',
  'balrog',
  'barrow-wight',
  'bilbo',
  'bill-the-pony',
  'boromir',
  'crebain',
  'doors-of-durin',
  'elrond',
  'elven-cloak',
  'ent',
  'eomer',
  'eowyn',
  'evenstar',
  'eye-of-sauron',
  'faramir',
  'fell-beast',
  'frodo',
  'galadriel',
  'gandalf-grey',
  'gandalf-white',
  'gimli',
  'gollum',
  'great-eagle',
  'great-worm',
  'horn-of-gondor',
  'huorn',
  'lembas',
  'legolas',
  'merry',
  'mirror-of-galadriel',
  'morgul-blade',
  'moth',
  'mouth-of-sauron',
  'mumakil',
  'narya',
  'nenya',
  'oliphaunt',
  'one-ring',
  'palantir',
  'phial-of-galadriel',
  'pippin',
  'radagast',
  'samwise',
  'saruman',
  'sauron',
  'shadowfax',
  'smaug',
  'sting',
  'treebeard',
  'vilya',
  'warg',
  'watcher-in-water',
  'white-tree',
  'witch-king',
] as const;

/** Type representing a valid avatar slug */
export type AvatarSlug = typeof VALID_AVATAR_SLUGS[number];

/**
 * Check if a string is a valid avatar slug.
 */
export function isValidAvatarSlug(slug: string): slug is AvatarSlug {
  return (VALID_AVATAR_SLUGS as readonly string[]).includes(slug);
}
