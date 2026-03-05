/**
 * Party Color Palette - 12 maximum distinctness colors for member identification.
 * Colors are assigned deterministically via user_id % PALETTE_SIZE.
 * For members beyond 12, colors repeat (spread out enough to avoid confusion).
 */

/** 12-color maximum distinctness palette */
export const PARTY_COLORS = [
  '#E6194B', // Red
  '#3CB44B', // Green
  '#4363D8', // Blue
  '#F58231', // Orange
  '#911EB4', // Purple
  '#42D4F4', // Cyan
  '#F032E6', // Magenta
  '#BFEF45', // Lime
  '#FABED4', // Pink
  '#469990', // Teal
  '#DCBEFF', // Lavender
  '#9A6324', // Brown
] as const;

export const PALETTE_SIZE = PARTY_COLORS.length;

/**
 * Get a color for a party member based on their color index.
 * The server returns `color: user_id % 12` in the progress response.
 */
export function getMemberColor(colorIndex: number): string {
  return PARTY_COLORS[colorIndex % PALETTE_SIZE];
}

/**
 * Get a desaturated/muted version of a member color for departed members.
 * Reduces saturation by blending toward gray.
 */
export function getMutedMemberColor(colorIndex: number): string {
  const hex = PARTY_COLORS[colorIndex % PALETTE_SIZE];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Blend 60% toward gray (128)
  const factor = 0.4;
  const mr = Math.round(r * factor + 128 * (1 - factor));
  const mg = Math.round(g * factor + 128 * (1 - factor));
  const mb = Math.round(b * factor + 128 * (1 - factor));

  return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
}
