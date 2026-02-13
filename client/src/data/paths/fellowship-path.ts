/**
 * Fellowship Path Data
 *
 * Defines the ordered coordinates of the Fellowship's journey on the
 * 10000×5455 pixel Middle-earth map (ctd58g7fsmyf1.webp).
 *
 * Coordinate system:
 *   Origin (0,0) = top-left of the full-resolution map image.
 *   x increases rightward, y increases downward.
 *
 * Path nodes:
 *   - "Anchor" nodes have a numeric `distance` (miles) matching a goal milestone.
 *   - "Geometry" nodes have `distance: null` — they exist only to shape
 *     the visual path between anchors (following roads/rivers on the map).
 *
 * Distances are in MILES (matching the goals table before km conversion).
 *
 * Tracing approach:
 *   Coordinates were mapped against the 10000×5455 WebP source image.
 *   Major locations (anchors) were identified by their labels on the map.
 *   Intermediate geometry points trace roads and rivers between anchors.
 *   If the base map asset changes, this file must be regenerated.
 */

export interface PathNode {
  x: number;
  y: number;
  /** Distance in miles from Bag End. null = geometry-only point. */
  distance: number | null;
}

/**
 * The full Fellowship path from Bag End to Mount Doom (1779 miles).
 *
 * Only the primary journey (Challenges 1–4) is traced here.
 * Return journey paths can be added as separate exports in the future.
 */
export const fellowshipPath: PathNode[] = [
  // ── The Shire ──────────────────────────────────────────────
  { x: 1740, y: 1580, distance: 0 },          // Bag End (Hobbiton)
  { x: 1770, y: 1600, distance: null },        // heading south-east
  { x: 1820, y: 1610, distance: null },        // along The Water
  { x: 1850, y: 1620, distance: 3 },           // Cross The Water
  { x: 1890, y: 1640, distance: null },        // Tookland area
  { x: 1920, y: 1630, distance: 5 },           // Cross Great Road, enter Tookland
  { x: 1980, y: 1620, distance: null },        // heading east
  { x: 2050, y: 1600, distance: 15 },          // Stock Road
  { x: 2120, y: 1580, distance: null },        // through farmland
  { x: 2200, y: 1560, distance: 32 },          // Encounter Black Rider
  { x: 2260, y: 1540, distance: null },        // continuing east
  { x: 2310, y: 1520, distance: 41 },          // Meet Elves
  { x: 2380, y: 1530, distance: null },        // south toward Maggot's
  { x: 2430, y: 1560, distance: 61 },          // Farmer Maggot's Field
  { x: 2470, y: 1540, distance: null },        // toward Buckleberry
  { x: 2510, y: 1510, distance: 70 },          // Buckleberry Ferry
  { x: 2530, y: 1500, distance: 73 },          // Crickhollow

  // ── Old Forest → Bree ──────────────────────────────────────
  { x: 2560, y: 1520, distance: null },        // into Old Forest
  { x: 2600, y: 1560, distance: 87 },          // Knoll in Old Forest
  { x: 2620, y: 1590, distance: null },        // deeper into forest
  { x: 2640, y: 1610, distance: 95 },          // Old Man Willow
  { x: 2650, y: 1630, distance: 98 },          // Tom Bombadil's House
  { x: 2680, y: 1600, distance: null },        // leaving Tom's
  { x: 2720, y: 1560, distance: 115 },         // Barrow Downs – captured by Wights
  { x: 2770, y: 1530, distance: null },        // heading to Bree
  { x: 2830, y: 1490, distance: null },        // approaching Bree
  { x: 2880, y: 1460, distance: 135 },         // Bree – The Prancing Pony

  // ── Bree → Weathertop ─────────────────────────────────────
  { x: 2920, y: 1440, distance: null },        // leaving Bree eastward
  { x: 2970, y: 1420, distance: 147 },         // Camp in Chetwood
  { x: 3040, y: 1400, distance: null },        // through Chetwood
  { x: 3100, y: 1390, distance: 165 },         // Leave Chetwood
  { x: 3170, y: 1380, distance: null },        // into marshes
  { x: 3230, y: 1370, distance: 179 },         // Camp in Western Marshes
  { x: 3310, y: 1360, distance: null },        // Midgewater Marshes
  { x: 3380, y: 1350, distance: 198 },         // East edge Midgewater
  { x: 3440, y: 1340, distance: null },        // continuing east
  { x: 3500, y: 1330, distance: 211 },         // Camp by stream
  { x: 3570, y: 1300, distance: null },        // approaching Weather Hills
  { x: 3630, y: 1270, distance: 229 },         // Camp foot of Weather Hills
  { x: 3700, y: 1230, distance: null },        // climbing to Weathertop
  { x: 3740, y: 1200, distance: 241 },         // Weathertop (Amon Sûl)

  // ── Weathertop → Rivendell ─────────────────────────────────
  { x: 3780, y: 1230, distance: null },        // fleeing Weathertop
  { x: 3830, y: 1260, distance: 260 },         // Camp south of Great Road
  { x: 3880, y: 1280, distance: null },        // heading east
  { x: 3930, y: 1290, distance: 271 },         // Camp
  { x: 3990, y: 1300, distance: null },        // curving valley
  { x: 4060, y: 1310, distance: 298 },         // Wide curving valley
  { x: 4140, y: 1320, distance: null },        // continuing in valley
  { x: 4220, y: 1310, distance: 328 },         // Continuing in valley
  { x: 4300, y: 1290, distance: null },        // toward Last Bridge
  { x: 4380, y: 1270, distance: 358 },         // Cross the Last Bridge
  { x: 4450, y: 1260, distance: null },        // past the bridge
  { x: 4530, y: 1280, distance: 392 },         // Stone Trolls
  { x: 4580, y: 1290, distance: null },        // past trolls
  { x: 4620, y: 1310, distance: 405 },         // Meet Glorfindel
  { x: 4700, y: 1330, distance: null },        // race to ford
  { x: 4780, y: 1340, distance: null },        // approaching Bruinen
  { x: 4840, y: 1320, distance: 450 },         // Ford of Bruinen
  { x: 4870, y: 1290, distance: null },        // into Rivendell valley
  { x: 4900, y: 1250, distance: 458 },         // Rivendell (Imladris)

  // ── Rivendell → Moria ──────────────────────────────────────
  { x: 4880, y: 1280, distance: null },        // leaving Rivendell south
  { x: 4860, y: 1330, distance: 466 },         // Ford of Bruinen
  { x: 4830, y: 1380, distance: null },        // heading south
  { x: 4800, y: 1440, distance: 480 },         // Steep canyon
  { x: 4780, y: 1490, distance: null },        // continuing south
  { x: 4760, y: 1540, distance: 484 },         // Cross small stream
  { x: 4740, y: 1600, distance: null },        // heading south
  { x: 4720, y: 1660, distance: 504 },         // Top of small hill
  { x: 4700, y: 1710, distance: null },        // stream west
  { x: 4680, y: 1760, distance: 516 },         // Small stream, follow west
  { x: 4650, y: 1810, distance: null },        // heading south-east
  { x: 4630, y: 1860, distance: 528 },         // Top of rise
  { x: 4600, y: 1920, distance: null },        // descending
  { x: 4580, y: 1960, distance: 544 },         // Another mountain spur
  { x: 4560, y: 1990, distance: 548 },         // Cliff top
  { x: 4540, y: 2040, distance: null },        // continuing south
  { x: 4520, y: 2090, distance: 560 },         // Cross small stream
  { x: 4490, y: 2150, distance: null },        // heading south
  { x: 4470, y: 2200, distance: 588 },         // Cross another stream
  { x: 4450, y: 2250, distance: null },        // hilltop area
  { x: 4430, y: 2290, distance: 608 },         // Hilltop, turning SE
  { x: 4410, y: 2340, distance: null },        // stream crossing
  { x: 4390, y: 2380, distance: 627 },         // Cross small stream
  { x: 4370, y: 2420, distance: 638 },         // Rolling Lands
  { x: 4340, y: 2480, distance: null },        // descending
  { x: 4310, y: 2540, distance: 668 },         // Land drops steeply
  { x: 4290, y: 2580, distance: 675 },         // Cross small stream
  { x: 4270, y: 2620, distance: null },        // climbing Hollin ridge
  { x: 4250, y: 2660, distance: 686 },         // N side Hollin Ridge
  { x: 4230, y: 2700, distance: 690 },         // Top Hollin Ridge – Crebain
  { x: 4210, y: 2740, distance: null },        // south into Eregion
  { x: 4200, y: 2790, distance: 708 },         // Cross small stream
  { x: 4220, y: 2850, distance: null },        // road climbs
  { x: 4260, y: 2900, distance: 733 },         // Road climbs higher
  { x: 4310, y: 2940, distance: null },        // foot of Redhorn
  { x: 4370, y: 2960, distance: 742 },         // Foot of Redhorn – debate
  { x: 4420, y: 2920, distance: null },        // climbing Redhorn
  { x: 4460, y: 2870, distance: 750 },         // Redhorn Pass – Caradhras
  { x: 4430, y: 2920, distance: null },        // back down
  { x: 4390, y: 2960, distance: 754 },         // Turn west, Crebain return
  { x: 4340, y: 2990, distance: null },        // heading to hill
  { x: 4280, y: 3010, distance: 778 },         // Warg attack hill
  { x: 4230, y: 3040, distance: null },        // toward Moria
  { x: 4180, y: 3060, distance: null },        // approaching gates
  { x: 4130, y: 3080, distance: 798 },         // Gates of Moria

  // ── Through Moria → Lothlórien ─────────────────────────────
  { x: 4160, y: 3100, distance: null },        // inside Moria
  { x: 4200, y: 3120, distance: null },        // Moria passages
  { x: 4240, y: 3130, distance: 818 },         // Junction of 3 passages
  { x: 4280, y: 3140, distance: null },        // deeper into Moria
  { x: 4320, y: 3150, distance: 838 },         // Balin's tomb
  { x: 4360, y: 3130, distance: null },        // escaping Moria
  { x: 4400, y: 3110, distance: 842 },         // Escape Moria – Silverlode
  { x: 4440, y: 3100, distance: null },        // heading east
  { x: 4490, y: 3120, distance: 855 },         // Enter Lothlórien
  { x: 4520, y: 3140, distance: null },        // into Lórien
  { x: 4560, y: 3160, distance: 861 },         // Cross Silverlode on ropes
  { x: 4620, y: 3200, distance: null },        // deeper into Lórien
  { x: 4680, y: 3240, distance: null },        // toward Cerin Amroth
  { x: 4730, y: 3270, distance: 906 },         // Hill of Cerin Amroth
  { x: 4760, y: 3300, distance: null },        // to Caras Galadhon
  { x: 4790, y: 3330, distance: 920 },         // Meet Galadriel – Challenge 2 End

  // ── Lothlórien → Amon Hen ──────────────────────────────────
  { x: 4810, y: 3350, distance: null },        // leaving Caras Galadhon
  { x: 4830, y: 3370, distance: 930 },         // Gifts from Galadriel, boats
  { x: 4860, y: 3390, distance: null },        // on the Anduin
  { x: 4890, y: 3420, distance: null },        // rowing south
  { x: 4920, y: 3460, distance: 951 },         // Camp west bank
  { x: 4960, y: 3510, distance: null },        // continuing south
  { x: 5000, y: 3560, distance: null },        // on the river
  { x: 5030, y: 3610, distance: 987 },         // Camp west bank
  { x: 5060, y: 3660, distance: null },        // trees thin out
  { x: 5080, y: 3700, distance: 1008 },        // Trees thin, overcast
  { x: 5100, y: 3750, distance: null },        // south on Anduin
  { x: 5120, y: 3800, distance: 1023 },        // Flats N of Celebrant
  { x: 5140, y: 3850, distance: null },        // river broadens
  { x: 5160, y: 3900, distance: 1040 },        // River broadens
  { x: 5190, y: 3960, distance: null },        // toward North Undeep
  { x: 5220, y: 4020, distance: 1063 },        // North Undeep
  { x: 5240, y: 4050, distance: null },        // River Limlight
  { x: 5250, y: 4070, distance: 1070 },        // Limlight enters
  { x: 5260, y: 4090, distance: 1075 },        // Sam spots Gollum
  { x: 5280, y: 4120, distance: null },        // continuing south
  { x: 5300, y: 4160, distance: 1083 },        // Camp on small eyot
  { x: 5340, y: 4220, distance: null },        // south on river
  { x: 5380, y: 4280, distance: 1122 },        // Eastern South Undeep
  { x: 5400, y: 4320, distance: null },        // continuing
  { x: 5420, y: 4360, distance: 1142 },        // Western South Undeep
  { x: 5440, y: 4400, distance: null },        // downs on both sides
  { x: 5460, y: 4430, distance: 1155 },        // Camp Day Feb 21
  { x: 5480, y: 4470, distance: null },        // lowlands
  { x: 5510, y: 4510, distance: 1180 },        // Lowlands
  { x: 5540, y: 4550, distance: null },        // continuing south
  { x: 5570, y: 4580, distance: 1205 },        // Camp Day Feb 22
  { x: 5600, y: 4600, distance: null },        // hills west
  { x: 5630, y: 4620, distance: 1220 },        // Hills, crumbling cliffs
  { x: 5660, y: 4640, distance: null },        // Emyn Muil
  { x: 5690, y: 4660, distance: 1234 },        // Higher Emyn Muil
  { x: 5720, y: 4680, distance: null },        // west shore camp
  { x: 5740, y: 4700, distance: 1255 },        // Camp west shore Feb 23
  { x: 5760, y: 4720, distance: null },        // rapids ahead
  { x: 5770, y: 4740, distance: 1267 },        // Sarn Gebir – Orc Attack
  { x: 5780, y: 4750, distance: 1269 },        // Carry boats to rapids
  { x: 5800, y: 4770, distance: null },        // past rapids
  { x: 5820, y: 4790, distance: 1288 },        // The Argonath
  { x: 5830, y: 4800, distance: 1290 },        // Nen Hithoel
  { x: 5850, y: 4830, distance: null },        // south on lake
  { x: 5870, y: 4860, distance: 1309 },        // Amon Hen – Challenge 3 End

  // ── Frodo & Sam: Emyn Muil → Dead Marshes → Mordor ─────────
  { x: 5900, y: 4840, distance: null },        // east from Amon Hen
  { x: 5950, y: 4810, distance: null },        // through Emyn Muil
  { x: 6010, y: 4780, distance: 1341 },        // Wetwang curves south
  { x: 6080, y: 4750, distance: null },        // capture Gollum area
  { x: 6150, y: 4710, distance: 1383 },        // Capture Gollum
  { x: 6230, y: 4670, distance: null },        // into Dead Marshes
  { x: 6320, y: 4630, distance: null },        // through marshes
  { x: 6420, y: 4590, distance: 1421 },        // Heart of Dead Marshes
  { x: 6520, y: 4550, distance: null },        // approaching Morannon
  { x: 6630, y: 4510, distance: null },        // nearing Black Gate
  { x: 6740, y: 4470, distance: 1463 },        // Desolation of Morannon – Black Gate

  // ── Ithilien → Shelob → Mount Doom ─────────────────────────
  { x: 6720, y: 4500, distance: null },        // turning south into Ithilien
  { x: 6690, y: 4540, distance: null },        // south through Ithilien
  { x: 6660, y: 4580, distance: null },        // into forest
  { x: 6640, y: 4620, distance: 1499 },        // Northern edge Ithilien
  { x: 6620, y: 4660, distance: null },        // deeper into Ithilien
  { x: 6600, y: 4710, distance: null },        // to Henneth Annûn
  { x: 6590, y: 4750, distance: 1533 },        // Henneth Annûn
  { x: 6610, y: 4790, distance: null },        // south through forest
  { x: 6640, y: 4830, distance: null },        // end of forest
  { x: 6670, y: 4860, distance: 1577 },        // End of forest
  { x: 6710, y: 4880, distance: null },        // toward Shelob
  { x: 6760, y: 4870, distance: null },        // approaching pass
  { x: 6810, y: 4850, distance: 1612 },        // Shelob's Lair
  { x: 6860, y: 4830, distance: null },        // into Mordor
  { x: 6910, y: 4800, distance: null },        // stagnant pool
  { x: 6950, y: 4770, distance: 1651 },        // Stagnant pool
  { x: 7000, y: 4740, distance: null },        // plain toward Isenmouthe
  { x: 7060, y: 4710, distance: null },        // drawing near
  { x: 7120, y: 4680, distance: 1698 },        // Near Isenmouthe
  { x: 7170, y: 4650, distance: null },        // across the plain
  { x: 7220, y: 4620, distance: null },        // approaching Mount Doom
  { x: 7270, y: 4590, distance: null },        // Dreadful Nightfall area
  { x: 7320, y: 4570, distance: 1755 },        // Dreadful Nightfall
  { x: 7370, y: 4560, distance: null },        // near Mount Doom
  { x: 7420, y: 4550, distance: null },        // final approach to Orodruin
  { x: 7460, y: 4540, distance: 1779 },        // Mount Doom – Orodruin
];
