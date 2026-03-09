// Tests for avatar slug inventory and validation
import { VALID_AVATAR_SLUGS, isValidAvatarSlug } from '../../src/avatar-slugs';
import * as fs from 'fs';
import * as path from 'path';

describe('Avatar Slugs', () => {
  describe('VALID_AVATAR_SLUGS', () => {
    it('should contain between 20 and 30 slugs', () => {
      expect(VALID_AVATAR_SLUGS.length).toBeGreaterThanOrEqual(20);
      expect(VALID_AVATAR_SLUGS.length).toBeLessThanOrEqual(30);
    });

    it('should contain only kebab-case slugs', () => {
      for (const slug of VALID_AVATAR_SLUGS) {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    });

    it('should contain no duplicates', () => {
      const uniqueSlugs = new Set(VALID_AVATAR_SLUGS);
      expect(uniqueSlugs.size).toBe(VALID_AVATAR_SLUGS.length);
    });

    it('should include key LOTR characters', () => {
      expect(VALID_AVATAR_SLUGS).toContain('frodo');
      expect(VALID_AVATAR_SLUGS).toContain('samwise');
      expect(VALID_AVATAR_SLUGS).toContain('gandalf-grey');
      expect(VALID_AVATAR_SLUGS).toContain('aragorn');
      expect(VALID_AVATAR_SLUGS).toContain('legolas');
      expect(VALID_AVATAR_SLUGS).toContain('gimli');
    });
  });

  describe('isValidAvatarSlug', () => {
    it('should accept valid slugs', () => {
      expect(isValidAvatarSlug('frodo')).toBe(true);
      expect(isValidAvatarSlug('gandalf-grey')).toBe(true);
      expect(isValidAvatarSlug('samwise')).toBe(true);
    });

    it('should reject invalid slugs', () => {
      expect(isValidAvatarSlug('nonexistent')).toBe(false);
      expect(isValidAvatarSlug('')).toBe(false);
      expect(isValidAvatarSlug('FRODO')).toBe(false);
      expect(isValidAvatarSlug('gandalf_grey')).toBe(false);
    });
  });

  describe('Avatar asset files', () => {
    const avatarsDir = path.resolve(__dirname, '../../public/img/avatars');
    const thumbsDir = path.resolve(__dirname, '../../public/img/avatars/thumbs');

    it('should have a full-size WebP file for each slug', () => {
      for (const slug of VALID_AVATAR_SLUGS) {
        const filePath = path.join(avatarsDir, `${slug}.webp`);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });

    it('should have a thumbnail WebP file for each slug', () => {
      for (const slug of VALID_AVATAR_SLUGS) {
        const filePath = path.join(thumbsDir, `${slug}.webp`);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });
  });
});
