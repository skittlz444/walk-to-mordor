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
  { x: 4440, y: 1340, distance: null },
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
  { x: 6037, y: 3369, distance: null },
  { x: 6048, y: 3402, distance: 1421 },        // Heart of Dead Marshes
  { x: 6055, y: 3457, distance: null },
  { x: 6094, y: 3440, distance: null },
  { x: 6152, y: 3443, distance: null },
  { x: 6191, y: 3469, distance: null },
  { x: 6231, y: 3499, distance: 1463 },        // Black Gate

  // -- Ithilien -> Shelob -> Mount Doom --
  { x: 5940, y: 3280, distance: null },
  { x: 5920, y: 3320, distance: null },
  { x: 5900, y: 3360, distance: null },
  { x: 6167, y: 3537, distance: 1499 },        // Northern edge Ithilien
  { x: 5870, y: 3440, distance: null },
  { x: 5862, y: 3480, distance: null },
  { x: 5858, y: 3520, distance: 1533 },        // Henneth Annun
  { x: 5870, y: 3560, distance: null },
  { x: 5890, y: 3598, distance: null },
  { x: 5910, y: 3630, distance: 1577 },        // End of forest
  { x: 5940, y: 3650, distance: null },
  { x: 5980, y: 3665, distance: null },
  { x: 6030, y: 3675, distance: null },
  { x: 6080, y: 3680, distance: 1612 },        // Shelob's Lair
  { x: 6130, y: 3690, distance: null },
  { x: 6190, y: 3700, distance: null },
  { x: 6250, y: 3710, distance: 1651 },        // Stagnant pool
  { x: 6310, y: 3720, distance: null },
  { x: 6370, y: 3728, distance: null },
  { x: 6430, y: 3735, distance: 1698 },        // Near Isenmouthe
  { x: 6470, y: 3740, distance: null },
  { x: 6510, y: 3745, distance: null },
  { x: 6540, y: 3748, distance: null },
  { x: 6555, y: 3750, distance: 1755 },        // Dreadful Nightfall
  { x: 6565, y: 3751, distance: null },
  { x: 6572, y: 3751, distance: 1779 },        // Mount Doom - Challenge 4 End

  // CHALLENGE 5: Mount Doom -> Minas Tirith

  { x: 6560, y: 3755, distance: null },
  { x: 6530, y: 3760, distance: null },
  { x: 6480, y: 3765, distance: null },
  { x: 6420, y: 3768, distance: 1798 },        // Camp along the road
  { x: 6350, y: 3770, distance: null },
  { x: 6280, y: 3760, distance: null },
  { x: 6200, y: 3745, distance: null },
  { x: 6120, y: 3720, distance: null },
  { x: 6050, y: 3698, distance: null },
  { x: 5990, y: 3680, distance: 1835 },        // Camp near Henneth Annun
  { x: 5950, y: 3670, distance: 1840 },        // Continue on Southward Road
  { x: 5900, y: 3665, distance: null },
  { x: 5850, y: 3668, distance: null },
  { x: 5800, y: 3672, distance: 1863 },        // Can see Amon Din due west
  { x: 5750, y: 3680, distance: null },
  { x: 5700, y: 3690, distance: 1886 },        // Landings of Osgiliath
  { x: 5670, y: 3695, distance: null },
  { x: 5640, y: 3700, distance: null },
  { x: 5610, y: 3710, distance: 1899 },        // Minas Tirith - Challenge 5 End

  // CHALLENGE 6: Minas Tirith -> Isengard

  { x: 5580, y: 3720, distance: null },
  { x: 5540, y: 3710, distance: null },
  { x: 5490, y: 3695, distance: null },
  { x: 5440, y: 3680, distance: 1949 },        // Camp N of Druadan Forest
  { x: 5380, y: 3665, distance: null },
  { x: 5320, y: 3650, distance: 2000 },        // Pass beacon on Nardol
  { x: 5260, y: 3638, distance: null },
  { x: 5200, y: 3625, distance: 2051 },        // Beacon hill of Minrimmon
  { x: 5160, y: 3618, distance: null },
  { x: 5120, y: 3610, distance: 2080 },        // Beacon tower of Calenhad
  { x: 5060, y: 3595, distance: null },
  { x: 5000, y: 3578, distance: null },
  { x: 4940, y: 3560, distance: 2166 },        // North of road, the Entwash
  { x: 4890, y: 3545, distance: null },
  { x: 4845, y: 3530, distance: 2206 },        // Leave the Folde
  { x: 4820, y: 3518, distance: null },
  { x: 4800, y: 3500, distance: null },
  { x: 4790, y: 3485, distance: 2260 },        // Ford the Snowbourne
  { x: 4775, y: 3465, distance: null },
  { x: 4755, y: 3445, distance: 2316 },        // Cross a small stream
  { x: 4730, y: 3428, distance: null },
  { x: 4708, y: 3415, distance: 2346 },        // Cross another small stream
  { x: 4680, y: 3400, distance: null },
  { x: 4650, y: 3388, distance: null },
  { x: 4620, y: 3378, distance: 2378 },        // Helm's Deep
  { x: 4580, y: 3365, distance: null },
  { x: 4540, y: 3345, distance: null },
  { x: 4500, y: 3320, distance: null },
  { x: 4460, y: 3295, distance: null },
  { x: 4420, y: 3270, distance: null },
  { x: 4395, y: 3250, distance: null },
  { x: 4380, y: 3230, distance: null },
  { x: 4370, y: 3200, distance: null },
  { x: 4365, y: 3170, distance: null },
  { x: 4362, y: 3140, distance: null },
  { x: 4360, y: 3110, distance: 2434 },        // Isengard - Challenge 6 End

  // CHALLENGE 7: Isengard -> Rivendell (return north)

  { x: 4350, y: 3090, distance: null },
  { x: 4340, y: 3060, distance: null },
  { x: 4325, y: 3030, distance: 2479 },        // Camp in Gap of Rohan
  { x: 4310, y: 3000, distance: null },
  { x: 4295, y: 2970, distance: 2509 },        // Camp by a small stream
  { x: 4278, y: 2940, distance: null },
  { x: 4260, y: 2912, distance: 2539 },        // Camp at base of Methedras
  { x: 4245, y: 2885, distance: null },
  { x: 4228, y: 2858, distance: 2569 },        // Roadway to Tharbad
  { x: 4212, y: 2832, distance: null },
  { x: 4195, y: 2808, distance: 2599 },        // Stop at a small stream
  { x: 4178, y: 2785, distance: null },
  { x: 4158, y: 2762, distance: 2629 },        // Enter Northern Dunland
  { x: 4135, y: 2738, distance: null },
  { x: 4110, y: 2712, distance: 2674 },        // Draw farther from foothills
  { x: 4085, y: 2688, distance: null },
  { x: 4058, y: 2662, distance: 2719 },        // Marshes of Swanfleet
  { x: 4032, y: 2638, distance: null },
  { x: 4008, y: 2615, distance: 2759 },        // Mists above Swanfleet
  { x: 3985, y: 2592, distance: null },
  { x: 3965, y: 2570, distance: 2809 },        // Ruins of Ost-en-Edhil
  { x: 3948, y: 2548, distance: null },
  { x: 3935, y: 2528, distance: 2839 },        // Mountains of Moria rise
  { x: 3920, y: 2508, distance: null },
  { x: 4779, y: 2067, distance: 2874 },        // Warg-attack hill
  { x: 3898, y: 2472, distance: null },
  { x: 3890, y: 2455, distance: 2909 },        // Open country, gentle slopes
  { x: 3882, y: 2435, distance: null },
  { x: 3878, y: 2415, distance: 2959 },        // Camp atop Hollin Ridge
  { x: 3875, y: 2392, distance: null },
  { x: 3872, y: 2368, distance: 3015 },        // Descend to stream valley
  { x: 3870, y: 2342, distance: null },
  { x: 3868, y: 2318, distance: 3049 },        // Climb NE, marsh ends
  { x: 3865, y: 2292, distance: null },
  { x: 3862, y: 2268, distance: 3071 },        // Loudwater in deep valley
  { x: 3858, y: 2240, distance: null },
  { x: 3855, y: 2212, distance: 3099 },        // Turn slightly west of north
  { x: 3850, y: 2180, distance: null },
  { x: 3848, y: 2148, distance: null },
  { x: 3850, y: 2115, distance: null },
  { x: 3855, y: 2080, distance: null },
  { x: 3862, y: 2045, distance: null },
  { x: 3870, y: 2010, distance: null },
  { x: 3880, y: 1975, distance: null },
  { x: 3895, y: 1940, distance: null },
  { x: 3910, y: 1905, distance: null },
  { x: 3930, y: 1870, distance: null },
  { x: 3955, y: 1835, distance: null },
  { x: 3980, y: 1800, distance: null },
  { x: 4010, y: 1765, distance: null },
  { x: 4040, y: 1730, distance: null },
  { x: 4075, y: 1695, distance: null },
  { x: 4110, y: 1660, distance: null },
  { x: 4145, y: 1625, distance: null },
  { x: 4180, y: 1590, distance: null },
  { x: 4215, y: 1555, distance: null },
  { x: 4250, y: 1520, distance: null },
  { x: 4285, y: 1485, distance: null },
  { x: 4320, y: 1450, distance: null },
  { x: 4355, y: 1415, distance: null },
  { x: 4390, y: 1380, distance: null },
  { x: 4420, y: 1355, distance: null },
  { x: 4879, y: 1470, distance: 3127 },        // Last Homely House - Challenge 7 End

  // CHALLENGE 8: Rivendell -> Bag End (return via Great Road)

  { x: 4440, y: 1335, distance: null },
  { x: 4430, y: 1340, distance: 3135 },        // Reach the Ford
  { x: 4415, y: 1345, distance: null },
  { x: 4807, y: 1515, distance: 3156 },        // Bruinen turns south
  { x: 4370, y: 1350, distance: null },
  { x: 4345, y: 1348, distance: 3185 },        // Pathway to Stone Trolls
  { x: 4318, y: 1342, distance: null },
  { x: 4290, y: 1335, distance: 3199 },        // Cross The Last Bridge
  { x: 4260, y: 1330, distance: null },
  { x: 4230, y: 1328, distance: 3219 },        // Open country
  { x: 4200, y: 1330, distance: null },
  { x: 4170, y: 1332, distance: 3234 },        // See tops of Weather Hills
  { x: 4140, y: 1334, distance: null },
  { x: 4108, y: 1335, distance: 3256 },        // Weather Hills rise
  { x: 4078, y: 1335, distance: null },
  { x: 4050, y: 1332, distance: 3279 },        // Weathertop visible
  { x: 4022, y: 1328, distance: null },
  { x: 3998, y: 1322, distance: 3294 },        // Land rises toward Hills
  { x: 3970, y: 1315, distance: null },
  { x: 3945, y: 1310, distance: 3324 },        // Weathertop immediately north
  { x: 3918, y: 1318, distance: null },
  { x: 3890, y: 1328, distance: 3359 },        // SE edge Midgewater Marshes
  { x: 3860, y: 1340, distance: null },
  { x: 3832, y: 1352, distance: 3391 },        // Camp. Marshes farther north
  { x: 3805, y: 1365, distance: null },
  { x: 3778, y: 1378, distance: 3423 },        // Forsaken Inn
  { x: 3748, y: 1392, distance: null },
  { x: 3718, y: 1405, distance: null },
  { x: 3688, y: 1418, distance: null },
  { x: 3662, y: 1435, distance: 3439 },        // Bree: The Prancing Pony
  { x: 3642, y: 1450, distance: null },
  { x: 3622, y: 1468, distance: 3455 },        // Old Forest to the south
  { x: 3600, y: 1485, distance: null },
  { x: 3575, y: 1498, distance: 3479 },        // Brandywine Bridge
  { x: 3548, y: 1508, distance: null },
  { x: 3520, y: 1515, distance: null },
  { x: 3490, y: 1518, distance: 3501 },        // Frogmorton
  { x: 3460, y: 1520, distance: null },
  { x: 3430, y: 1522, distance: null },
  { x: 3400, y: 1525, distance: null },
  { x: 3370, y: 1527, distance: null },
  { x: 3340, y: 1528, distance: null },
  { x: 3310, y: 1529, distance: null },
  { x: 3280, y: 1529, distance: null },
  { x: 3250, y: 1529, distance: null },
  { x: 3220, y: 1529, distance: null },
  { x: 3190, y: 1529, distance: null },
  { x: 3165, y: 1529, distance: 3524 },        // Bag End - Challenge 8 End

  // CHALLENGE 9: Bag End -> Grey Havens -> Bag End

  // -- Bag End -> West to Grey Havens --
  { x: 3150, y: 1530, distance: null },
  { x: 3130, y: 1530, distance: 3538 },        // Reach Stock Road
  { x: 3108, y: 1530, distance: null },
  { x: 3085, y: 1528, distance: 3561 },        // Road splits
  { x: 3060, y: 1525, distance: null },
  { x: 3035, y: 1520, distance: null },
  { x: 3010, y: 1515, distance: 3588 },        // Green Hill Country
  { x: 2985, y: 1510, distance: null },
  { x: 2960, y: 1505, distance: null },
  { x: 2935, y: 1500, distance: 3614 },        // Camp in the open lands
  { x: 2912, y: 1495, distance: null },
  { x: 2890, y: 1490, distance: 3626 },        // South of Tuckburrow
  { x: 2868, y: 1485, distance: null },
  { x: 2845, y: 1478, distance: 3639 },        // Beyond the Downs
  { x: 2820, y: 1470, distance: null },
  { x: 2795, y: 1462, distance: 3669 },        // Crest of the Far Downs
  { x: 2770, y: 1455, distance: null },
  { x: 2745, y: 1448, distance: 3684 },        // Tower Hills on horizon
  { x: 2720, y: 1440, distance: null },
  { x: 2695, y: 1432, distance: 3704 },        // Land rises toward Tower Hills
  { x: 2668, y: 1425, distance: null },
  { x: 2640, y: 1418, distance: 3724 },        // Great East Road
  { x: 2612, y: 1410, distance: null },
  { x: 2585, y: 1402, distance: 3744 },        // Road reaches the Towers
  { x: 2558, y: 1395, distance: null },
  { x: 2530, y: 1388, distance: 3764 },        // Land drops toward the Gulf
  { x: 2502, y: 1382, distance: null },
  { x: 2475, y: 1375, distance: null },
  { x: 2450, y: 1368, distance: 3784 },        // Grey Havens - Final Farewell

  // -- Return: Grey Havens -> Bag End --
  { x: 2478, y: 1375, distance: null },
  { x: 2510, y: 1382, distance: 3814 },        // Camp at Tower Hills
  { x: 2542, y: 1390, distance: null },
  { x: 2575, y: 1398, distance: 3839 },        // Foot of the Hills
  { x: 2608, y: 1405, distance: null },
  { x: 2640, y: 1412, distance: 3864 },        // See Far Downs ahead
  { x: 2672, y: 1420, distance: null },
  { x: 2705, y: 1430, distance: 3884 },        // Western face of Far Downs
  { x: 2738, y: 1440, distance: null },
  { x: 2770, y: 1448, distance: 3904 },        // Camp next to the road
  { x: 2800, y: 1455, distance: null },
  { x: 2830, y: 1462, distance: 3919 },        // See grazing lands
  { x: 2862, y: 1470, distance: null },
  { x: 2895, y: 1478, distance: 3934 },        // Michel Delving
  { x: 2930, y: 1488, distance: null },
  { x: 2968, y: 1498, distance: null },
  { x: 3008, y: 1508, distance: 3969 },        // Waymeet
  { x: 3048, y: 1518, distance: null },
  { x: 3088, y: 1525, distance: null },
  { x: 3128, y: 1528, distance: null },
  { x: 3165, y: 1529, distance: 3991 },        // Sam arrives at Bag End - THE END
];
