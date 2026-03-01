import { describe, expect, it } from 'vitest';
import {
  PARTY_COLORS,
  PALETTE_SIZE,
  getMemberColor,
  getMutedMemberColor,
} from './party-colors';

describe('party-colors', () => {
  it('defines 12 distinct colors', () => {
    expect(PARTY_COLORS).toHaveLength(12);
    expect(PALETTE_SIZE).toBe(12);

    // All unique
    const unique = new Set(PARTY_COLORS);
    expect(unique.size).toBe(12);
  });

  it('returns color by index within palette', () => {
    expect(getMemberColor(0)).toBe('#E6194B');
    expect(getMemberColor(1)).toBe('#3CB44B');
    expect(getMemberColor(11)).toBe('#9A6324');
  });

  it('wraps around for indices >= PALETTE_SIZE', () => {
    expect(getMemberColor(12)).toBe(getMemberColor(0));
    expect(getMemberColor(25)).toBe(getMemberColor(1));
  });

  it('returns valid hex color strings', () => {
    for (let i = 0; i < PALETTE_SIZE; i++) {
      expect(getMemberColor(i)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('returns muted colors that differ from originals', () => {
    for (let i = 0; i < PALETTE_SIZE; i++) {
      const original = getMemberColor(i);
      const muted = getMutedMemberColor(i);
      expect(muted).toMatch(/^#[0-9a-f]{6}$/);
      expect(muted).not.toBe(original.toLowerCase());
    }
  });

  it('muted colors are closer to gray than originals', () => {
    // The muted color channels should be closer to 128 than the original
    const hex = PARTY_COLORS[0]; // #E6194B (red)
    const muted = getMutedMemberColor(0);

    const origR = parseInt(hex.slice(1, 3), 16);
    const mutedR = parseInt(muted.slice(1, 3), 16);

    // Muted should be closer to 128 than original
    expect(Math.abs(mutedR - 128)).toBeLessThan(Math.abs(origR - 128));
  });
});
