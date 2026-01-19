# Goals Gap Analysis - Gaps > 70km

This file contains the analysis of gaps greater than 70km between consecutive goals in the Walk to Mordor project. This information will be used to populate intermediary goals in a future migration.

**Analysis Date:** 2026-01-19
**Total Goals Analyzed:** 165
**Total Gaps > 70km:** 19

## Gap Details

### Gap #1: 72.42 km (45.00 miles)
- **Before:** 651.78 km (405 miles) - Meet Glorfindel
- **After:** 724.20 km (450 miles) - Attacked by Nazgul at the Ford of Bruinen

### Gap #2: 72.42 km (45.00 miles)
- **Before:** 1385.64 km (861 miles) - Cross the Silverlode on ropes
- **After:** 1458.06 km (906 miles) - Reach the hill of Cerin Amroth

### Gap #3: 70.81 km (44.00 miles)
- **Before:** 2467.12 km (1533 miles) - Led to Henneth Annûn
- **After:** 2537.93 km (1577 miles) - End of the forest

### Gap #4: 75.64 km (47.00 miles)
- **Before:** 2657.02 km (1651 miles) - Stagnant pool of water
- **After:** 2732.66 km (1698 miles) - Out on the plain, drawing near Isenmouthe

### Gap #5: 91.73 km (57.00 miles)
- **Before:** 2732.66 km (1698 miles) - Out on the plain, drawing near Isenmouthe
- **After:** 2824.39 km (1755 miles) - The Dreadful Nightfall

### Gap #6: 80.47 km (50.00 miles)
- **Before:** 3056.14 km (1899 miles) - Reach the Gates of Minas Tirith
- **After:** 3136.60 km (1949 miles) - Camp by road north of the Drúadan Forest

### Gap #7: 82.08 km (51.00 miles)
- **Before:** 3136.60 km (1949 miles) - Camp by road north of the Drúadan Forest
- **After:** 3218.68 km (2000 miles) - Pass the beacon on Nardol, the “Fire Hill”

### Gap #8: 82.08 km (51.00 miles)
- **Before:** 3218.68 km (2000 miles) - Pass the beacon on Nardol, the “Fire Hill”
- **After:** 3300.76 km (2051 miles) - The beacon hill of Minrimmon is on the left

### Gap #9: 138.40 km (86.00 miles) ⚠️ LARGEST GAP
- **Before:** 3347.43 km (2080 miles) - The beacon tower of Calenhad stands on a foothill of Calenhad peak
- **After:** 3485.83 km (2166 miles) - North of the road, is the Entwash

### Gap #10: 86.90 km (54.00 miles)
- **Before:** 3550.20 km (2206 miles) - Leave the Folde
- **After:** 3637.11 km (2260 miles) - Ford the Snowbourne

### Gap #11: 90.12 km (56.00 miles)
- **Before:** 3637.11 km (2260 miles) - Ford the Snowbourne
- **After:** 3727.23 km (2316 miles) - Cross a small stream

### Gap #12: 90.12 km (56.00 miles)
- **Before:** 3827.01 km (2378 miles) - Reach Helm’s Deep
- **After:** 3917.13 km (2434 miles) - Treegarth of Orthanc, Isengard is no more

### Gap #13: 72.42 km (45.00 miles)
- **Before:** 3917.13 km (2434 miles) - Treegarth of Orthanc, Isengard is no more
- **After:** 3989.55 km (2479 miles) - Camp, still in the Gap of Rohan

### Gap #14: 72.42 km (45.00 miles)
- **Before:** 4230.95 km (2629 miles) - Enter Northern Dunland
- **After:** 4303.38 km (2674 miles) - Draw farther and farther from the mountains and foothills

### Gap #15: 72.42 km (45.00 miles)
- **Before:** 4303.38 km (2674 miles) - Draw farther and farther from the mountains and foothills
- **After:** 4375.80 km (2719 miles) - Marshes of the Swanfleet lie to the north

### Gap #16: 80.47 km (50.00 miles)
- **Before:** 4440.17 km (2759 miles) - Can see mists above the fens of the Swanfleet delta
- **After:** 4520.64 km (2809 miles) - Reach the ruins of Ost-en-Edhil

### Gap #17: 80.47 km (50.00 miles)
- **Before:** 4681.57 km (2909 miles) - Open country. Gentle slopes, easier for the ponies
- **After:** 4762.04 km (2959 miles) - Camp atop Hollin Ridge among the large smooth towering rocks

### Gap #18: 90.12 km (56.00 miles)
- **Before:** 4762.04 km (2959 miles) - Camp atop Hollin Ridge among the large smooth towering rocks
- **After:** 4852.16 km (3015 miles) - Descend a slope to a small stream valley

### Gap #19: 85.30 km (53.00 miles)
- **Before:** 5730.86 km (3561 miles) - Reach the point where the road splits
- **After:** 5816.15 km (3614 miles) - Camp in the open lands

## CSV Data

A machine-readable CSV file with this data is available at [goals-gaps-analysis.csv](goals-gaps-analysis.csv).

## Implementation Notes

1. **Current Status:** The schema update (`image_id` column) has been implemented in migration `0021_add_image_id_to_goals.sql`
2. **Future Work:** A separate migration will be needed to insert intermediary goals into these gaps
3. **Image Handling:** New intermediary goals should have `image_id` set to NULL
4. **Special Field:** New intermediary goals should have `special` set to NULL unless they represent significant narrative moments

## Suggested Intermediary Goals (from Story Definition)

The story document suggested these specific intermediary goals:

1. **Woody End** (~23 miles / 37 km): Between Stock Road (15 mi / 24 km) and Black Rider (32 mi / 51 km)
   - Gap: ~27 km (under 70km threshold, so not in this analysis)

2. **The High Hay** (~80 miles / 129 km): Between Crickhollow (73 mi / 117 km) and Old Forest (87 mi / 140 km)
   - Gap: ~23 km (under 70km threshold, so not in this analysis)

3. **Fog on the Downs** (~106 miles / 171 km): Between Bombadil (98 mi / 158 km) and Wights (115 mi / 185 km)
   - Gap: ~27 km (under 70km threshold, so not in this analysis)

4. **The East Road** (~125 miles / 201 km): Between Wights (115 mi / 185 km) and Bree (135 mi / 217 km)
   - Gap: ~32 km (under 70km threshold, so not in this analysis)

5. **Emyn Muil Foothills** (~1167 miles / 1878 km): Between Camp (1155 mi / 1859 km) and Lowlands (1180 mi / 1899 km)
   - Gap: ~40 km (under 70km threshold, so not in this analysis)

**Note:** The suggested intermediary goals from the story document are all in areas with gaps under 70km, so they are not included in this analysis. However, they may still be valuable for narrative pacing.