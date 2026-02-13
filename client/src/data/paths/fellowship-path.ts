/**
 * Fellowship Path Data
 *
 * Defines the ordered coordinates of the full journey on the
 * 10000x5455 pixel Middle-earth map (ctd58g7fsmyf1.webp).
 *
 * Coordinate system:
 *   Origin (0,0) = top-left of the full-resolution map image.
 *   x increases rightward, y increases downward.
 *
 * Key reference points used for calibration:
 *   Hobbiton:     (3165, 1529)
 *   Mount Doom:   (6572, 3751)
 *
 * Path nodes:
 *   - "Anchor" nodes have a numeric `distance` (miles) matching a goal milestone.
 *   - "Geometry" nodes have `distance: null` -- they exist only to shape
 *     the visual path between anchors (following roads/rivers on the map).
 *
 * Distances are in MILES (matching the goals table before km conversion).
 *
 * Tracing approach:
 *   Coordinates were mapped against the 10000x5455 WebP source image.
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
 * The full journey from Bag End through all 9 challenges (3991 miles).
 *
 * Challenge 1: Bag End -> Rivendell (458 mi)
 * Challenge 2: Rivendell -> Lothlorien (920 mi)
 * Challenge 3: Lothlorien -> Amon Hen (1309 mi)
 * Challenge 4: Amon Hen -> Mount Doom (1779 mi)
 * Challenge 5: Mount Doom -> Minas Tirith (1899 mi)
 * Challenge 6: Minas Tirith -> Isengard (2434 mi)
 * Challenge 7: Isengard -> Rivendell (3127 mi)
 * Challenge 8: Rivendell -> Bag End (3524 mi)
 * Challenge 9: Bag End -> Grey Havens -> Bag End (3991 mi)
 */
export const fellowshipPath: PathNode[] = [
  // CHALLENGE 1: Bag End -> Rivendell

  // -- The Shire --
  { x: 3165, y: 1529, distance: 0 },          // Bag End (Hobbiton)
  { x: 3235, y: 1599, distance: 3 },           // Cross The Water
  { x: 3283, y: 1618, distance: null },
  { x: 3364, y: 1610, distance: 73 },          // Crickhollow

  // -- Old Forest -> Bree --
  { x: 3426, y: 1600, distance: 87 },          // Knoll in Old Forest
  { x: 3496, y: 1600, distance: 95 },          // Old Man Willow
  { x: 3535, y: 1635, distance: 98 },          // Tom Bombadil's House
  { x: 3583, y: 1598, distance: 115 },         // Barrow Downs
  { x: 3677, y: 1618, distance: 125 },         // Cross the Withywindle
  { x: 3683, y: 1563, distance: 135 },         // Bree - The Prancing Pony

  // -- Bree -> Weathertop --
  { x: 3705, y: 1515, distance: null },
  { x: 3732, y: 1502, distance: 147 },         // Camp in Chetwood
  { x: 3761, y: 1501, distance: 165 },         // Leave Chetwood
  { x: 3799, y: 1485, distance: 179 },         // Camp in Western Marshes
  { x: 3874, y: 1489, distance: 198 },         // East edge Midgewater
  { x: 3982, y: 1522, distance: 229 },         // Camp foot of Weather Hills
  { x: 4056, y: 1477, distance: 241 },         // Weathertop (Amon Sul)

  // -- Weathertop -> Rivendell --
  { x: 4119, y: 1556, distance: null },
  { x: 4284, y: 1517, distance: null },
  { x: 4470, y: 1462, distance: 358 },         // Cross the Last Bridge
  { x: 4557, y: 1467, distance: null },
  { x: 4642, y: 1445, distance: null },
  { x: 4738, y: 1469, distance: null },
  { x: 4807, y: 1515, distance: 450 },         // Ford of Bruinen
  { x: 4850, y: 1510, distance: null },
  { x: 4879, y: 1470, distance: 458 },         // Rivendell - Challenge 1 End

  // CHALLENGE 2: Rivendell -> Lothlorien

  // -- South along Misty Mountains --
  { x: 4807, y: 1515, distance: 466 },         // Ford of Bruinen
  { x: 4840, y: 1575, distance: null },
  { x: 4891, y: 1665, distance: null },
  { x: 4834, y: 1814, distance: null },
  { x: 4756, y: 1893, distance: 608 },         // Hilltop, turning SE
  { x: 4799, y: 1966, distance: 686 },         // N side Hollin Ridge

  // -- Caradhras attempt and Moria --
  { x: 4841, y: 2011, distance: 742 },         // Foot of Redhorn
  { x: 4922, y: 2002, distance: 750 },         // Redhorn Pass - Caradhras
  { x: 4808, y: 2041, distance: 754 },         // Turn west, Crebain return
  { x: 4779, y: 2067, distance: 778 },         // Warg attack hill
  { x: 4701, y: 2161, distance: null },        // along cliff face
  { x: 4779, y: 2159, distance: 798 },         // Gates of Moria

  // -- Through Moria -> Lothlorien --
  { x: 4799, y: 2183, distance: null },
  { x: 4819, y: 2154, distance: null },
  { x: 4792, y: 2134, distance: null },
  { x: 4828, y: 2116, distance: null },
  { x: 4873, y: 2178, distance: 842 },         // Escape Moria - Silverlode
  { x: 4894, y: 2266, distance: null },
  { x: 5034, y: 2300, distance: 855 },         // Enter Lothlorien
  { x: 5082, y: 2338, distance: 861 },         // Cross Silverlode on ropes
  { x: 5164, y: 2316, distance: 920 },         // Meet Galadriel - Challenge 2 End

  // CHALLENGE 3: Lothlorien -> Amon Hen (down the Anduin)

  { x: 5178, y: 2363, distance: null },
  { x: 5224, y: 2370, distance: 930 },         // Gifts from Galadriel, boats
  { x: 5262, y: 2392, distance: null },
  { x: 5270, y: 2423, distance: null },
  { x: 5282, y: 2443, distance: null },
  { x: 5287, y: 2478, distance: null },
  { x: 5332, y: 2515, distance: null },
  { x: 5379, y: 2541, distance: 1023 },        // Flats N of Celebrant
  { x: 5424, y: 2576, distance: null },
  { x: 5453, y: 2599, distance: null },
  { x: 5484, y: 2612, distance: null },
  { x: 5535, y: 2630, distance: null },
  { x: 5551, y: 2649, distance: 1063 },        // North Undeep
  { x: 5528, y: 2703, distance: null },
  { x: 5509, y: 2756, distance: 1070 },        // Limlight enters
  { x: 5531, y: 2791, distance: null },
  { x: 5567, y: 2803, distance: null },
  { x: 5602, y: 2795, distance: null },
  { x: 5644, y: 2770, distance: 1122 },        // Eastern South Undeep
  { x: 5676, y: 2830, distance: null },
  { x: 5598, y: 2902, distance: 1142 },        // Western South Undeep
  { x: 5618, y: 2941, distance: null },
  { x: 5662, y: 2965, distance: null },
  { x: 5688, y: 3023, distance: null },
  { x: 5687, y: 3064, distance: null },
  { x: 5655, y: 3111, distance: null },
  { x: 5642, y: 3192, distance: null },
  { x: 5657, y: 3261, distance: 1234 },        // Higher Emyn Muil
  { x: 5691, y: 3340, distance: 1288 },        // The Argonath
  { x: 5703, y: 3390, distance: 1290 },        // Nen Hithoel
  { x: 5695, y: 3425, distance: 1309 },        // Amon Hen - Challenge 3 End

  // CHALLENGE 4: Amon Hen -> Mount Doom (Frodo & Sam)

  // -- Emyn Muil -> Dead Marshes -> Mordor --
  { x: 5731, y: 3392, distance: null },
  { x: 5771, y: 3344, distance: null },
  { x: 5838, y: 3335, distance: 1341 },        // Wetwang curves south
  { x: 5841, y: 3289, distance: 1383 },        // Capture Gollum
  { x: 5904, y: 3306, distance: null },
  { x: 5922, y: 3351, distance: null },
  { x: 5990, y: 3393, distance: null },
  { x: 6007, y: 3376, distance: null },
  { x: 6033, y: 3380, distance: null },
  { x: 6048, y: 3402, distance: 1421 },        // Heart of Dead Marshes
  { x: 6055, y: 3457, distance: null },
  { x: 6094, y: 3440, distance: null },
  { x: 6152, y: 3443, distance: null },
  { x: 6191, y: 3469, distance: null },
  { x: 6231, y: 3499, distance: 1463 },        // Black Gate

  // -- Ithilien -> Shelob -> Mount Doom --
  { x: 6176, y: 3542, distance: null },
  { x: 6155, y: 3568, distance: null },
  { x: 6155, y: 3640, distance: 1499 },        // Northern edge Ithilien
  { x: 6144, y: 3767, distance: 1533 },        // Henneth Annun
  { x: 6192, y: 3923, distance: 1577 },        // End of forest
  { x: 6239, y: 3920, distance: null },
  { x: 6245, y: 3879, distance: 1612 },        // Shelob's Lair
  { x: 6311, y: 3754, distance: null },
  { x: 6318, y: 3653, distance: null },
  { x: 6290, y: 3612, distance: null },
  { x: 6350, y: 3588, distance: null },
  { x: 6418, y: 3578, distance: 1698 },        // Near Isenmouthe
  { x: 6484, y: 3576, distance: null },
  { x: 6547, y: 3637, distance: null },
  { x: 6553, y: 3702, distance: 1755 },        // Dreadful Nightfall
  { x: 6572, y: 3751, distance: 1779 },        // Mount Doom - Challenge 4 End

  // CHALLENGE 5: Mount Doom -> Minas Tirith

  { x: 6231, y: 3499, distance: 1798 },        // Camp along the road
  { x: 6177, y: 3546, distance: null },
  { x: 6185, y: 3712, distance: null },
  { x: 6188, y: 3765, distance: 1835 },        // Camp near Henneth Annun
  { x: 6192, y: 3839, distance: null },
  { x: 6192, y: 3929, distance: null },
  { x: 6120, y: 3934, distance: 1886 },        // Landings of Osgiliath
  { x: 6057, y: 3960, distance: 1899 },        // Minas Tirith - Challenge 5 End

  // CHALLENGE 6: Minas Tirith -> Isengard

  { x: 6025, y: 3916, distance: null },
  { x: 5850, y: 3853, distance: 1949 },        // Camp N of Druadan Forest
  { x: 5716, y: 3812, distance: null },
  { x: 5534, y: 3794, distance: 2124 },        // Beacon tower of Firien Wood
  { x: 5343, y: 3754, distance: null },
  { x: 5243, y: 3701, distance: null },
  { x: 5115, y: 3647, distance: null },
  { x: 4995, y: 3520, distance: 2206 },        // Leave the Folde
  { x: 4952, y: 3509, distance: null },
  { x: 4928, y: 3483, distance: 2260 },        // Ford the Snowbourne
  { x: 4824, y: 3386, distance: null },
  { x: 4719, y: 3313, distance: null },
  { x: 4681, y: 3357, distance: 2378 },        // Helm's Deep
  { x: 4710, y: 3306, distance: null },
  { x: 4554, y: 3210, distance: 2410 },        // Cross the Ford of Isen
  { x: 4561, y: 3122, distance: null },
  { x: 4549, y: 3032, distance: 2434 },        // Isengard - Challenge 6 End

  // CHALLENGE 7: Isengard -> Rivendell (return north)

  { x: 4577, y: 3162, distance: 2479 },        // Camp in Gap of Rohan
  { x: 4544, y: 3208, distance: null },
  { x: 4371, y: 3191, distance: null },
  { x: 4325, y: 3125, distance: 2539 },        // Camp at base of Methedras
  { x: 4227, y: 2933, distance: 2569 },        // Roadway to Tharbad
  { x: 4110, y: 2544, distance: 2629 },        // Enter Northern Dunland
  { x: 4210, y: 2379, distance: 2719 },        // Marshes of Swanfleet
  { x: 4260, y: 2340, distance: 2759 },        // Mists above Swanfleet
  { x: 4306, y: 2304, distance: 2809 },        // Ruins of Ost-en-Edhil
  { x: 4460, y: 2233, distance: 2839 },        // Mountains of Moria rise
  { x: 4779, y: 2067, distance: 2874 },        // Warg-attack hill
  { x: 4773, y: 1896, distance: 2959 },        // Camp atop Hollin Ridge
  { x: 4821, y: 1811, distance: null },
  { x: 4828, y: 1648, distance: null },
  { x: 4879, y: 1470, distance: 3127 },        // Last Homely House - Challenge 7 End

  // CHALLENGE 8: Rivendell -> Bag End (return via Great Road)

  { x: 4842, y: 1515, distance: null },
  { x: 4807, y: 1520, distance: 3135 },        // Reach the Ford
  { x: 4694, y: 1500, distance: null },
  { x: 4567, y: 1479, distance: 3185 },        // Pathway to Stone Trolls
  { x: 4475, y: 1462, distance: 3199 },        // Cross The Last Bridge
  { x: 4316, y: 1458, distance: null },
  { x: 4110, y: 1527, distance: 3294 },        // Land rises toward Hills
  { x: 4031, y: 1546, distance: 3324 },        // Weathertop immediately north
  { x: 3876, y: 1539, distance: 3359 },        // SE edge Midgewater Marshes
  { x: 3830, y: 1538, distance: 3391 },        // Camp. Marshes farther north
  { x: 3726, y: 1546, distance: null },
  { x: 3683, y: 1563, distance: 3439 },        // Bree: The Prancing Pony
  { x: 3629, y: 1504, distance: null },
  { x: 3595, y: 1484, distance: 3455 },        // Old Forest to the south
  { x: 3364, y: 1497, distance: 3479 },        // Brandywine Bridge
  { x: 3298, y: 1518, distance: null },
  { x: 3231, y: 1547, distance: null },
  { x: 3165, y: 1529, distance: 3524 },        // Bag End - Challenge 8 End

  // CHALLENGE 9: Bag End -> Grey Havens -> Bag End

  // -- Bag End -> West to Grey Havens --
  { x: 3142, y: 1564, distance: null },
  { x: 3091, y: 1567, distance: 3561 },        // Road splits
  { x: 3060, y: 1616, distance: null },
  { x: 2974, y: 1599, distance: 3639 },        // Beyond the Downs
  { x: 2910, y: 1585, distance: 3669 },        // Crest of the Far Downs
  { x: 2850, y: 1605, distance: 3704 },        // Land rises toward Tower Hills
  { x: 2743, y: 1550, distance: 3744 },        // Road reaches the Towers
  { x: 2675, y: 1581, distance: 3764 },        // Land drops toward the Gulf
  { x: 2551, y: 1524, distance: 3784 },        // Grey Havens - Final Farewell

  // -- Return: Grey Havens -> Bag End --
  { x: 2675, y: 1581, distance: null },
  { x: 2743, y: 1550, distance: 3814 },        // Camp at Tower Hills
  { x: 2850, y: 1605, distance: 3864 },        // See Far Downs ahead
  { x: 2910, y: 1585, distance: null },
  { x: 2974, y: 1599, distance: 3884 },        // Western face of Far Downs
  { x: 3060, y: 1616, distance: 3919 },        // See grazing lands
  { x: 3091, y: 1567, distance: 3934 },        // Michel Delving
  { x: 3142, y: 1564, distance: null },
  { x: 3165, y: 1529, distance: 3991 },        // Sam arrives at Bag End - THE END
];
