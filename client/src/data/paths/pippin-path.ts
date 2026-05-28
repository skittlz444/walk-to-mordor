/**
 * Pippin Path Data
 *
 * Defines Peregrin Took's book journey on the same 10000x5455 pixel
 * Middle-earth map used by the Fellowship route.
 *
 * Shared legs deliberately reuse `fellowshipPath` coordinates:
 *   - Bag End -> Amon Hen
 *   - Minas Tirith -> Isengard -> Rivendell -> Bag End
 *   - Bag End -> Grey Havens -> Bag End
 *
 * Pippin-specific legs are traced from the book route:
 *   - Captured at Parth Galen and carried toward Fangorn
 *   - Fangorn and the Ents' march to Isengard
 *   - Gandalf's ride with Pippin to Minas Tirith
 *   - The Army of the West to the Black Gate and return to Minas Tirith
 *
 * Distances are in miles from Bag End, matching the path interpolation system.
 */

import { fellowshipPath, type PathNode } from './fellowship-path';

const AMON_HEN_DISTANCE = 1309;
const BLACK_GATE_RETURN_DISTANCE = 1798;
const MINAS_TIRITH_DISTANCE = 1899;
const ISENGARD_DISTANCE = 2434;
const RIVENDELL_RETURN_DISTANCE = 3127;
const BAG_END_RETURN_DISTANCE = 3524;
const FELLOWSHIP_FINAL_DISTANCE = 3991;

const PIPPIN_ISENGARD_DISTANCE = 1555;
const PIPPIN_MINAS_TIRITH_DISTANCE = 2090;
const PIPPIN_BLACK_GATE_DISTANCE = 2212;
const PIPPIN_MINAS_TIRITH_RETURN_DISTANCE = 2313;
const PIPPIN_ISENGARD_RETURN_DISTANCE = 2848;
const PIPPIN_RIVENDELL_RETURN_DISTANCE = 3541;
const PIPPIN_BAG_END_RETURN_DISTANCE = 3938;

const HELMS_DEEP_X = 4681;
const HELMS_DEEP_Y = 3357;

function cloneNode(node: PathNode): PathNode {
  return { x: node.x, y: node.y, distance: node.distance };
}

function findAnchorIndex(distance: number): number {
  const index = fellowshipPath.findIndex((node) => node.distance === distance);
  if (index === -1) {
    throw new Error(`Missing fellowship path anchor for ${distance} miles`);
  }
  return index;
}

function copySharedPathThrough(endDistance: number): PathNode[] {
  const endIndex = findAnchorIndex(endDistance);
  return fellowshipPath.slice(0, endIndex + 1).map(cloneNode);
}

function copyShiftedSharedSegment(
  startDistance: number,
  endDistance: number,
  shiftedStartDistance: number,
): PathNode[] {
  const startIndex = findAnchorIndex(startDistance);
  const endIndex = findAnchorIndex(endDistance);
  return fellowshipPath.slice(startIndex + 1, endIndex + 1).map((node) => ({
    x: node.x,
    y: node.y,
    distance: node.distance === null
      ? null
      : shiftedStartDistance + (node.distance - startDistance),
  }));
}

function copyReversedSharedSegment(
  startDistance: number,
  endDistance: number,
  shiftedStartDistance: number,
  shiftedEndDistance = shiftedStartDistance + (endDistance - startDistance),
): PathNode[] {
  const startIndex = findAnchorIndex(startDistance);
  const endIndex = findAnchorIndex(endDistance);
  const sourceSpan = endDistance - startDistance;
  const shiftedSpan = shiftedEndDistance - shiftedStartDistance;

  return fellowshipPath.slice(startIndex, endIndex).reverse().map((node) => ({
    x: node.x,
    y: node.y,
    distance: node.distance === null
      ? null
      : Math.round(shiftedStartDistance + ((endDistance - node.distance) / sourceSpan) * shiftedSpan),
  }));
}

const pippinIsengardToMinasTirithPath: PathNode[] = [
  { x: 4561, y: 3122, distance: null },        // South from Isengard
  { x: 4577, y: 3162, distance: null },        // Dol Baran, the palantir
  ...copyReversedSharedSegment(
    MINAS_TIRITH_DISTANCE,
    ISENGARD_DISTANCE,
    PIPPIN_ISENGARD_DISTANCE,
  ).slice(1).filter((node) => node.x !== HELMS_DEEP_X || node.y !== HELMS_DEEP_Y),
];

const pippinMinasTirithToBlackGatePath = copyReversedSharedSegment(
  BLACK_GATE_RETURN_DISTANCE,
  MINAS_TIRITH_DISTANCE,
  PIPPIN_MINAS_TIRITH_DISTANCE,
  PIPPIN_BLACK_GATE_DISTANCE,
);

const pippinBranch: PathNode[] = [
  // Amon Hen -> Fangorn -> Isengard
  { x: 5587, y: 3374, distance: null },        // Orcs leave Parth Galen
  { x: 5499, y: 3275, distance: 1348 },        // Orc trail across the Wold
  { x: 5275, y: 3083, distance: 1396 },        // Pippin drops his brooch
  { x: 5113, y: 2980, distance: 1436 },        // Riders strike the Orcs
  { x: 5059, y: 2956, distance: 1442 },        // Escape into Fangorn
  { x: 5021, y: 2935, distance: 1450 },        // Meet Treebeard
  { x: 4950, y: 2878, distance: 1485 },        // Entmoot in Fangorn
  { x: 4881, y: 2892, distance: 1515 },
  { x: 4734, y: 3004, distance: 1535 },        // Ents march on Isengard
  { x: 4549, y: 3032, distance: PIPPIN_ISENGARD_DISTANCE },        // Isengard flooded

  // Isengard -> Minas Tirith with Gandalf
  ...pippinIsengardToMinasTirithPath,

  // Minas Tirith -> Black Gate -> Minas Tirith
  ...pippinMinasTirithToBlackGatePath,
  ...copyShiftedSharedSegment(
    BLACK_GATE_RETURN_DISTANCE,
    MINAS_TIRITH_DISTANCE,
    PIPPIN_BLACK_GATE_DISTANCE,
  ),
];

/** The complete Pippin storyline route, Bag End -> Grey Havens -> Bag End. */
export const pippinPath: PathNode[] = [
  ...copySharedPathThrough(AMON_HEN_DISTANCE),
  ...pippinBranch,
  ...copyShiftedSharedSegment(
    MINAS_TIRITH_DISTANCE,
    ISENGARD_DISTANCE,
    PIPPIN_MINAS_TIRITH_RETURN_DISTANCE,
  ),
  ...copyShiftedSharedSegment(
    ISENGARD_DISTANCE,
    RIVENDELL_RETURN_DISTANCE,
    PIPPIN_ISENGARD_RETURN_DISTANCE,
  ),
  ...copyShiftedSharedSegment(
    RIVENDELL_RETURN_DISTANCE,
    BAG_END_RETURN_DISTANCE,
    PIPPIN_RIVENDELL_RETURN_DISTANCE,
  ),
  ...copyShiftedSharedSegment(
    BAG_END_RETURN_DISTANCE,
    FELLOWSHIP_FINAL_DISTANCE,
    PIPPIN_BAG_END_RETURN_DISTANCE,
  ),
];