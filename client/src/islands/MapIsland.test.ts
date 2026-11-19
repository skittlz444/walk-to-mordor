import { describe, expect, it } from 'vitest';
import { tileUrl } from './MapIsland';

describe('tileUrl', () => {
  it('appends the shared tile-set version to every tile URL', () => {
    expect(tileUrl(2, 3, 4, '82c61e0bcb82'))
      .toBe('/img/map/tiles/2/3_4.webp?v=82c61e0bcb82');
  });

  it('falls back to unversioned tile URLs when metadata has no version', () => {
    expect(tileUrl(0, 0, 0)).toBe('/img/map/tiles/0/0_0.webp');
    expect(tileUrl(0, 0, 0, undefined)).toBe('/img/map/tiles/0/0_0.webp');
  });
});
