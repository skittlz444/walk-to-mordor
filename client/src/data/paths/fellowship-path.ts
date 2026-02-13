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
  { x: 3185, y: 1540, distance: null },
  { x: 3210, y: 1548, distance: null },
  { x: 3230, y: 1555, distance: 3 },           // Cross The Water
  { x: 3255, y: 1558, distance: null },
  { x: 3275, y: 1555, distance: 5 },           // Cross Great Road, enter Tookland
  { x: 3310, y: 1548, distance: null },
  { x: 3340, y: 1540, distance: 15 },          // Reach Stock Road
  { x: 3375, y: 1530, distance: null },
  { x: 3410, y: 1520, distance: 32 },          // Encounter Black Rider
  { x: 3440, y: 1515, distance: null },
  { x: 3465, y: 1510, distance: 41 },          // Meet Elves
  { x: 3490, y: 1518, distance: null },
  { x: 3510, y: 1530, distance: 61 },          // Farmer Maggot's Field
  { x: 3530, y: 1525, distance: null },
  { x: 3548, y: 1515, distance: 70 },          // Buckleberry Ferry
  { x: 3560, y: 1510, distance: 73 },          // Crickhollow

  // -- Old Forest -> Bree --
  { x: 3575, y: 1520, distance: null },
  { x: 3590, y: 1540, distance: 87 },          // Knoll in Old Forest
  { x: 3600, y: 1555, distance: null },
  { x: 3608, y: 1568, distance: 95 },          // Old Man Willow
  { x: 3612, y: 1580, distance: 98 },          // Tom Bombadil's House
  { x: 3620, y: 1565, distance: null },
  { x: 3630, y: 1540, distance: 115 },         // Barrow Downs
  { x: 3640, y: 1510, distance: null },
  { x: 3650, y: 1480, distance: null },
  { x: 3660, y: 1450, distance: 135 },         // Bree - The Prancing Pony

  // -- Bree -> Weathertop --
  { x: 3680, y: 1440, distance: null },
  { x: 3700, y: 1430, distance: 147 },         // Camp in Chetwood
  { x: 3730, y: 1418, distance: null },
  { x: 3755, y: 1408, distance: 165 },         // Leave Chetwood
  { x: 3780, y: 1398, distance: null },
  { x: 3800, y: 1390, distance: 179 },         // Camp in Western Marshes
  { x: 3830, y: 1380, distance: null },
  { x: 3855, y: 1370, distance: 198 },         // East edge Midgewater
  { x: 3878, y: 1360, distance: null },
  { x: 3900, y: 1350, distance: 211 },         // Camp by stream
  { x: 3925, y: 1335, distance: null },
  { x: 3948, y: 1318, distance: 229 },         // Camp foot of Weather Hills
  { x: 3970, y: 1300, distance: null },
  { x: 3990, y: 1280, distance: 241 },         // Weathertop (Amon Sul)

  // -- Weathertop -> Rivendell --
  { x: 4008, y: 1290, distance: null },
  { x: 4030, y: 1305, distance: 260 },         // Camp south of Great Road
  { x: 4055, y: 1315, distance: null },
  { x: 4078, y: 1320, distance: 271 },         // Camp
  { x: 4105, y: 1325, distance: null },
  { x: 4135, y: 1330, distance: 298 },         // Wide curving valley
  { x: 4170, y: 1335, distance: null },
  { x: 4205, y: 1332, distance: 328 },         // Continuing in valley
  { x: 4238, y: 1328, distance: null },
  { x: 4268, y: 1322, distance: 358 },         // Cross the Last Bridge
  { x: 4298, y: 1330, distance: null },
  { x: 4320, y: 1340, distance: 392 },         // Stone Trolls
  { x: 4338, y: 1345, distance: null },
  { x: 4355, y: 1348, distance: 405 },         // Meet Glorfindel
  { x: 4378, y: 1350, distance: null },
  { x: 4400, y: 1348, distance: null },
  { x: 4418, y: 1342, distance: 450 },         // Ford of Bruinen
  { x: 4432, y: 1335, distance: null },
  { x: 4445, y: 1325, distance: 458 },         // Rivendell - Challenge 1 End

  // CHALLENGE 2: Rivendell -> Lothlorien

  // -- South along Misty Mountains --
  { x: 4440, y: 1340, distance: null },
  { x: 4435, y: 1365, distance: 466 },         // Ford of Bruinen
  { x: 4428, y: 1400, distance: null },
  { x: 4420, y: 1440, distance: 480 },         // Steep canyon
  { x: 4415, y: 1475, distance: null },
  { x: 4410, y: 1510, distance: 484 },         // Cross small stream
  { x: 4405, y: 1555, distance: null },
  { x: 4400, y: 1600, distance: 504 },         // Top of small hill
  { x: 4395, y: 1640, distance: null },
  { x: 4390, y: 1680, distance: 516 },         // Small stream, follow west
  { x: 4385, y: 1720, distance: null },
  { x: 4380, y: 1760, distance: 528 },         // Top of rise
  { x: 4378, y: 1800, distance: null },
  { x: 4375, y: 1835, distance: 544 },         // Another mountain spur
  { x: 4373, y: 1855, distance: 548 },         // Cliff top
  { x: 4370, y: 1890, distance: null },
  { x: 4368, y: 1925, distance: 560 },         // Cross small stream
  { x: 4365, y: 1965, distance: null },
  { x: 4362, y: 2005, distance: 588 },         // Cross another stream
  { x: 4360, y: 2040, distance: null },
  { x: 4358, y: 2075, distance: 608 },         // Hilltop, turning SE
  { x: 4360, y: 2110, distance: null },
  { x: 4362, y: 2140, distance: 627 },         // Cross small stream
  { x: 4365, y: 2170, distance: 638 },         // Rolling Lands
  { x: 4370, y: 2210, distance: null },
  { x: 4375, y: 2248, distance: 668 },         // Land drops steeply
  { x: 4378, y: 2275, distance: 675 },         // Cross small stream
  { x: 4382, y: 2305, distance: null },
  { x: 4388, y: 2335, distance: 686 },         // N side Hollin Ridge
  { x: 4395, y: 2360, distance: 690 },         // Top Hollin Ridge - Crebain
  { x: 4400, y: 2390, distance: null },
  { x: 4408, y: 2425, distance: 708 },         // Cross small stream
  { x: 4420, y: 2465, distance: null },
  { x: 4435, y: 2505, distance: 733 },         // Road climbs higher

  // -- Caradhras attempt and Moria --
  { x: 4450, y: 2535, distance: null },
  { x: 4468, y: 2558, distance: 742 },         // Foot of Redhorn
  { x: 4488, y: 2530, distance: null },
  { x: 4505, y: 2500, distance: 750 },         // Redhorn Pass - Caradhras
  { x: 4490, y: 2528, distance: null },
  { x: 4475, y: 2555, distance: 754 },         // Turn west, Crebain return
  { x: 4455, y: 2575, distance: null },
  { x: 4435, y: 2590, distance: 778 },         // Warg attack hill
  { x: 4415, y: 2600, distance: null },
  { x: 4495, y: 2310, distance: null },
  { x: 4480, y: 2280, distance: 798 },         // Gates of Moria

  // -- Through Moria -> Lothlorien --
  { x: 4500, y: 2300, distance: null },
  { x: 4520, y: 2320, distance: null },
  { x: 4545, y: 2340, distance: 818 },         // Junction of 3 passages
  { x: 4570, y: 2355, distance: null },
  { x: 4595, y: 2370, distance: 838 },         // Balin's tomb
  { x: 4618, y: 2380, distance: null },
  { x: 4640, y: 2388, distance: 842 },         // Escape Moria - Silverlode
  { x: 4665, y: 2395, distance: null },
  { x: 4695, y: 2410, distance: 855 },         // Enter Lothlorien
  { x: 4720, y: 2425, distance: null },
  { x: 4745, y: 2440, distance: 861 },         // Cross Silverlode on ropes
  { x: 4775, y: 2465, distance: null },
  { x: 4808, y: 2490, distance: null },
  { x: 4835, y: 2518, distance: 906 },         // Hill of Cerin Amroth
  { x: 4850, y: 2540, distance: null },
  { x: 4862, y: 2558, distance: 920 },         // Meet Galadriel - Challenge 2 End

  // CHALLENGE 3: Lothlorien -> Amon Hen (down the Anduin)

  { x: 4870, y: 2575, distance: null },
  { x: 4878, y: 2595, distance: 930 },         // Gifts from Galadriel, boats
  { x: 4890, y: 2620, distance: null },
  { x: 4905, y: 2655, distance: null },
  { x: 4920, y: 2690, distance: 951 },         // Camp west bank
  { x: 4940, y: 2730, distance: null },
  { x: 4958, y: 2770, distance: null },
  { x: 4975, y: 2808, distance: 987 },         // Camp west bank
  { x: 4990, y: 2840, distance: null },
  { x: 5005, y: 2870, distance: 1008 },        // Trees thin, overcast
  { x: 5018, y: 2898, distance: null },
  { x: 5030, y: 2925, distance: 1023 },        // Flats N of Celebrant
  { x: 5042, y: 2950, distance: null },
  { x: 5055, y: 2975, distance: 1040 },        // River broadens
  { x: 5068, y: 3000, distance: null },
  { x: 5082, y: 3025, distance: 1063 },        // North Undeep
  { x: 5090, y: 3040, distance: null },
  { x: 5098, y: 3052, distance: 1070 },        // Limlight enters
  { x: 5105, y: 3062, distance: 1075 },        // Sam spots Gollum
  { x: 5115, y: 3080, distance: null },
  { x: 5128, y: 3098, distance: 1083 },        // Camp on small eyot
  { x: 5145, y: 3125, distance: null },
  { x: 5162, y: 3155, distance: 1122 },        // Eastern South Undeep
  { x: 5172, y: 3175, distance: null },
  { x: 5180, y: 3195, distance: 1142 },        // Western South Undeep
  { x: 5188, y: 3215, distance: null },
  { x: 5195, y: 3232, distance: 1155 },        // Camp Day Feb 21
  { x: 5202, y: 3250, distance: null },
  { x: 5210, y: 3268, distance: 1180 },        // Lowlands
  { x: 5218, y: 3288, distance: null },
  { x: 5225, y: 3308, distance: 1205 },        // Camp Day Feb 22
  { x: 5230, y: 3322, distance: null },
  { x: 5235, y: 3338, distance: 1220 },        // Hills, crumbling cliffs
  { x: 5240, y: 3352, distance: null },
  { x: 5245, y: 3368, distance: 1234 },        // Higher Emyn Muil
  { x: 5248, y: 3382, distance: null },
  { x: 5250, y: 3398, distance: 1255 },        // Camp west shore Feb 23
  { x: 5252, y: 3412, distance: null },
  { x: 5255, y: 3425, distance: 1267 },        // Sarn Gebir - Orc Attack
  { x: 5258, y: 3435, distance: 1269 },        // Carry boats to rapids
  { x: 5262, y: 3450, distance: null },
  { x: 5268, y: 3468, distance: 1288 },        // The Argonath
  { x: 5272, y: 3478, distance: 1290 },        // Nen Hithoel
  { x: 5278, y: 3498, distance: null },
  { x: 5285, y: 3520, distance: 1309 },        // Amon Hen - Challenge 3 End

  // CHALLENGE 4: Amon Hen -> Mount Doom (Frodo & Sam)

  // -- Emyn Muil -> Dead Marshes -> Mordor --
  { x: 5310, y: 3510, distance: null },
  { x: 5350, y: 3495, distance: null },
  { x: 5400, y: 3475, distance: 1341 },        // Wetwang curves south
  { x: 5460, y: 3455, distance: null },
  { x: 5520, y: 3430, distance: 1383 },        // Capture Gollum
  { x: 5580, y: 3400, distance: null },
  { x: 5650, y: 3370, distance: null },
  { x: 5720, y: 3340, distance: 1421 },        // Heart of Dead Marshes
  { x: 5800, y: 3310, distance: null },
  { x: 5870, y: 3280, distance: null },
  { x: 5950, y: 3250, distance: 1463 },        // Black Gate

  // -- Ithilien -> Shelob -> Mount Doom --
  { x: 5940, y: 3280, distance: null },
  { x: 5920, y: 3320, distance: null },
  { x: 5900, y: 3360, distance: null },
  { x: 5885, y: 3400, distance: 1499 },        // Northern edge Ithilien
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
  { x: 3908, y: 2490, distance: 2874 },        // Warg-attack hill
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
  { x: 4445, y: 1325, distance: 3127 },        // Last Homely House - Challenge 7 End

  // CHALLENGE 8: Rivendell -> Bag End (return via Great Road)

  { x: 4440, y: 1335, distance: null },
  { x: 4430, y: 1340, distance: 3135 },        // Reach the Ford
  { x: 4415, y: 1345, distance: null },
  { x: 4395, y: 1348, distance: 3156 },        // Bruinen turns south
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
