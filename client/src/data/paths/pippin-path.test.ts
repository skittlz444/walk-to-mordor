import { describe, expect, it } from 'vitest';
import { getUserPosition } from '../../utils/map-utils';
import { fellowshipPath } from './fellowship-path';
import { pippinPath } from './pippin-path';
import { getPathByKey } from './registry';

function anchorDistances() {
  return pippinPath
    .map((node) => node.distance)
    .filter((distance): distance is number => distance !== null);
}

describe('pippinPath', () => {
  it('is registered under the pippin path key', () => {
    expect(getPathByKey('pippin')).toBe(pippinPath);
  });

  it('reuses the fellowship path through Amon Hen', () => {
    const amonHenIndex = fellowshipPath.findIndex((node) => node.distance === 1309);
    expect(amonHenIndex).toBeGreaterThan(0);
    expect(pippinPath.slice(0, amonHenIndex + 1)).toEqual(
      fellowshipPath.slice(0, amonHenIndex + 1),
    );
  });

  it('keeps anchor distances strictly increasing', () => {
    const distances = anchorDistances();

    for (let index = 1; index < distances.length; index++) {
      expect(distances[index]).toBeGreaterThan(distances[index - 1]);
    }
  });

  it('places key Pippin branch milestones on the expected map anchors', () => {
    expect(getUserPosition(pippinPath, 1396)).toEqual({ x: 5128, y: 2992 });
    expect(getUserPosition(pippinPath, 1436)).toEqual({ x: 4868, y: 2900 });
    expect(getUserPosition(pippinPath, 1450)).toEqual({ x: 4718, y: 2858 });
    expect(getUserPosition(pippinPath, 1555)).toEqual({ x: 4549, y: 3032 });
    expect(getUserPosition(pippinPath, 1579)).toEqual({ x: 4554, y: 3210 });
    expect(getUserPosition(pippinPath, 1729)).toEqual({ x: 4928, y: 3483 });
    expect(getUserPosition(pippinPath, 2040)).toEqual({ x: 5850, y: 3853 });
    expect(getUserPosition(pippinPath, 2090)).toEqual({ x: 6057, y: 3960 });
    expect(getUserPosition(pippinPath, 2106)).toEqual({ x: 6120, y: 3934 });
    expect(getUserPosition(pippinPath, 2212)).toEqual({ x: 6231, y: 3499 });
  });

  it('skips Helm\'s Deep on the outbound ride but keeps it on the return', () => {
    expect(getUserPosition(pippinPath, 1611)).not.toEqual({ x: 4681, y: 3357 });
    expect(getUserPosition(pippinPath, 2792)).toEqual({ x: 4681, y: 3357 });
  });

  it('finishes the Grey Havens return loop at Bag End', () => {
    const distances = anchorDistances();
    expect(distances[distances.length - 1]).toBe(4405);
    expect(pippinPath[pippinPath.length - 1]).toEqual({ x: 3165, y: 1529, distance: 4405 });
  });
});