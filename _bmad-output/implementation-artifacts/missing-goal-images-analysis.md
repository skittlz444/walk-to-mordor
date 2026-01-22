# Missing Goal Images Analysis

**Generated:** 2026-01-22  
**Purpose:** Rebuild the missing-goal-images list using live database image IDs and actual files in `public/img/`.

---

## Summary

- **Total Goals in DB:** 190
- **Highres JPG images present:** 92 (includes `0.jpg` fallback)
- **Highres WEBP images present:** 2
- **Thumb JPG images present:** 92 (includes `0-thumb.jpg` fallback)
- **Goals missing highres (no JPG or WEBP):** 80
- **Goals missing thumbs:** 81
- **Goals missing both:** 99
  - 80 goals with non-null `image_id` missing both JPG/WEBP highres and thumbs
  - 19 goals with `image_id = NULL`

**Sanity checks:**
- **Reach Crickhollow** (`id=9`) has `image_id=9` and **is not missing**.
- **Cross on the Buckleberry Ferry** (`id=8`) has `image_id=8` and **is missing**.

---

## Images Available

### Highres JPG IDs (`public/img/highres/*.jpg`)
```
0,1,2,3,4,7,9,10,11,12,14,15,16,17,18,19,21,25,26,27,28,29,30,32,34,35,37,40,41,45,46,48,49,51,52,53,54,56,57,58,59,61,62,63,65,67,68,69,70,75,77,80,86,87,90,91,92,93,101,109,110,111,114,118,119,120,121,122,123,124,128,130,133,137,138,139,140,143,145,146,147,150,151,155,156,160,163,164,167,168,169,170
```

### Highres WEBP IDs (`public/img/highres/*.webp`)
```
brandywine-bridge-tookland,meet-elves
```

### Thumb JPG IDs (`public/img/thumbs/*-thumb.jpg`)
```
0,1,2,3,4,7,9,10,11,12,14,15,16,17,18,19,21,25,26,27,28,29,30,32,34,35,37,40,41,45,46,48,49,51,52,53,54,56,57,58,59,61,62,63,65,67,68,69,70,75,77,80,86,87,90,91,92,93,101,109,110,111,114,118,119,120,121,122,123,124,128,130,133,137,138,139,140,143,145,146,147,150,151,155,156,160,163,164,167,168,169,170
```

---

## Goals Missing Images

**Definition:** Missing any required image where highres accepts JPG or WEBP, and thumbs require JPG.

| ID | Distance (miles) | Title | Image ID | Missing status | Validated prompt | Done |
|---:|---:|---|---|---|---|---|
| 3 | 5 | Cross The Great Road from the Brandywine Bridge. Enter Tookland. (5 miles/8 km) | brandywine-bridge-tookland | missing-thumb | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, low Shire countryside with gentle rolling farmland, cultivated fields, thick hedgerows and roadside banks, small trees and bushes, the wide pale Great Road running east–west with the Brandywine Bridge behind to the west, hedgerow-lined lanes and shadowed verges on the Tookland side, no buildings or ruins, night under clear moonlight with cool silver-blue glow, long shadows, growing dread and urgency, deep shadows with subtle ambient light and misty distance, three small hobbit figures stepping off the Great Road into the dark lane, cloaked silhouettes with packs, faces indistinct, High detail, museum quality, square format, no text, no watermarks, no borders | generated-not-tested |
| 5 | 32 | Encounter with Black Rider | 5 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, Shire East Road winding through gentle rolling countryside with hedges, banks, and farmland fields, an old oak tree beside the road dominating the scene, hedgerows and grass in muted autumn tones, late afternoon slipping toward twilight with cool clear air and lengthening shadows, a sudden dread in the still landscape with subtle ambient glow and deepening shade, small hobbit figures in simple cloaks hiding among the oak roots while a Black Rider on a dark horse halts on the road and lifts his head to sniff the air, High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 6 | 41 | Meet Elves | 6 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, dense wooded country at Woody End above Woodhall with tall trees framing a starlit clearing beneath the canopy, soft ground cover and shadowed trunks, no rivers, no mountains, no buildings, night under a clear starry sky with a hush of elvish song, mood shifting from dread to wonder and relief, subtle ambient glow and deep shadows with cool starlight and a gentle elvish radiance on the clearing, small figures in the landscape: three hobbits with cloaks and packs standing or seated near the edge of the clearing, opposite a company of High Elves with slender silhouettes and light cloaks, shared white bread and fragrant wine suggested by pale shapes on the ground, High detail, museum quality, square format, no text, no watermarks, no borders | generated-not-tested |
| 8 | 70 | Cross on the Buckleberry Ferry | 8 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, the broad, dark, slow Brandywine River with the Buckleberry Ferry flat-boat and landing stages on both banks, Shire riverbank greenery and the Buckland countryside beyond, late-night mist rising from the water, cool damp air, urgency and dread, subtle ambient glow with deep shadows along the dark shoreline, small figures on the flat-boat pushing off—Frodo, Sam, Pippin, Merry and the ferryman—cloaked Black Rider arriving on the Shire-side landing as a distant silhouette, warm/cool contrast in the lights and mist, limited harmonious palette, High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 13 | 115 | The Hobbits are captured by Wights | 13 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, the Barrow-downs as open treeless rolling grassy hills and hollows, short grass and sparse low vegetation, ancient earth-covered barrow mounds with stone chambers, a few standing stones on some heights, thick white fog swallowing the landscape and separating the forms, dread and confusion, time uncertain in the fog-drenched gloom, subtle cold ambient glow with deep shadows and faint warm glints on ancient gold ornaments, four small hobbit figures in the distance and half-lost in the mist, simple cloaks and hoods with no faces visible, secondary to the landscape, a dark barrow mound with a pale arm reaching toward a sword across a white-clad hobbit’s neck in the shadowed chamber entrance, High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 20 | 229 | Camp at the foot of the Weather Hills | 20 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, open bleak uplands with wind-scoured slopes, shallow hollows and low banks, sparse short grass and low scrub; Weathertop (Amon Sûl) rising as the highest peak, its summit crowned by broken ring-walls and fallen stone ruins; a small camp tucked in a hollow at the hill-feet. Mounting dread and watchfulness, late afternoon into blue-grey dusk and nightfall, exposed cold wind, long shadows, darkening sky with a subtle ambient glow and deep shadows, misty distance desaturated. Small figures in the landscape: Frodo, Sam, Merry, Pippin, and Strider as cloaked silhouettes near the camp, faces indistinct, secondary to the landscape. High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 22 | 260 | Camp in thickets south of the Great East Road | 22 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, pathless country south of the Great East Road with rolling heath, low hills and ridges, patches of scrub and tangled thickets, sparse trees, the road only hinted at nearby while a hidden camp nestles deep in the brush, no structures. Cool autumn air, subdued shadowed concealment, urgency and dread with exhaustion, overcast light filtering through, subtle ambient glow, deep shadows, mist-softened distance and desaturated background hills. Small figures crouched low in dense thickets: five cloaked travelers, one weak and leaning, another watchful scout standing apart, faces indistinct, no bright firelight. High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 23 | 271 | Camp | 23 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, bleak broken country of low weather-worn hills and hollows, a cheerless hollow beneath stained hills with sparse scrub and coarse grass, no structures, a small low fire nestled in the hollow, night camp in cold damp mist clinging low, dread and weariness with urgency, dim firelight against grey mist and hill silhouettes, subtle ambient glow with deep shadows and desaturated distance, warm/cool contrast between firelight and chilling mist, tiny figures in the landscape: Frodo pale and slumped near the fire, Sam, Merry, and Pippin close by as cloaked silhouettes, Strider standing apart keeping watch facing east, High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 24 | 298 | Following a wide shallow curving valley | 24 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, bleak Lone-lands with wide shallow valleys and broken hills, an open rolling country crossed by a faint forgotten track and earth-swallowed road remnants, ruins of Arnor with crumbled towers and broken walls on ridge lines silhouetted against the grey sky, sparse scrub, heather, and coarse grass with little tree cover, weariness and urgency under grey, chill, cheerless overcast light, lingering dread and misted distance with desaturated depth, warm/cool contrast in muted earth and slate tones, small figures in the landscape: a hunched rider on a pony, cloaked ranger scanning ahead, three hobbit silhouettes in travel-worn cloaks following close, High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 31 | 466 | Reach Ford of Bruinen | 31 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, steep paths climbing out of Rivendell’s narrow hidden valley, the Ford of Bruinen far below with the Loudwater cutting a deep cleft, foothills of the Misty Mountains rising ahead, winter subdued greenery and rocky slopes, somber resolve on a cold, grey winter morning with still air and muted light, subtle dramatic lighting with cool shadows and a faint ambient glow, small figures of the full Fellowship of nine ascending the path in cloaks and travel gear, seen as tiny silhouettes against the landscape, High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 33 | 484 | Cross a small stream | 33 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, open uplands at the western foot of the Misty Mountains in Hollin/Eregion; exposed slopes and ridges with sparse grasses, heather, and scrub; a small swift mountain-fed stream crossing with slick stones; distant Misty Mountains softened by mist. Cold winter atmosphere, pale muted light with uncertain time of day, a sense of weariness and vigilance, exposed and watched; cool air and subdued palette with gentle warm/cool contrast in the light. The full Fellowship of nine as small figures crossing the stream on the stones, cloaks and travel-worn silhouettes, heads bowed against the cold, figures secondary to the vast moorland. High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 36 | 528 | Reached the top of a rise, heading Southeast | 36 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, rolling treeless uplands of Hollin/Eregion with long low ridges and bare slopes, broad open land west of the Misty Mountains, cresting a bare rise and looking southeast toward the Redhorn Gate, bleak waves of land with sparse winter grass and heather in brown and grey tones, no structures visible. Overcast pale daylight, cold wintry wind, exposed and empty, gathering gloom, mood of weariness and vigilance. The full Fellowship of nine as small figures in the landscape, Gandalf present, Sam adjusting his pack, seen as silhouettes in travel-worn cloaks, no facial detail. High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 38 | 548 | Path comes to a steep drop-off, go along cliff top | 38 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, Hollin/Eregion uplands with bare stony ridge country and a sudden sheer drop into a deep trough valley, broken red-brown stones across open treeless slopes, sparse winter grass and low scrub, the ridge edge prominent with the faint line of running water far below, cold clear daylight with a chill wind from the eastern mountains, a mood of weariness and caution, exposed and uneasy, dramatic but restrained lighting with cool clarity and subtle warm notes on stone, misty background depth through desaturation, the full Fellowship of nine as small figures in the landscape, cloaked silhouettes moving carefully along the ridge, Aragorn scouting the brink, High detail, museum quality, square format, no text, no watermarks, no borders |  |
| 39 | 560 | Cross a small stream | 39 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, open uplands of Hollin/Eregion with treeless rolling ground, stones and heather, red-brown earth tones, a shallow stream with slick stones and a cold clear exposed streambed, ancient holly-trees standing as remnants of old Elvish land. Tense, watchful, exposed and cold atmosphere, silence and the feeling of being observed, subdued light with dramatic contrasts in a limited, harmonious palette. The full Fellowship of nine as small figures in the landscape; Aragorn testing the footing by the stream, Legolas watchful at the edge of the group. High detail, museum quality, square format, no text, no watermarks, no borders. |  |
| 42 | 627 | Cross a small stream | 42 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, an open expanse of Eregion/Hollin: low ridges of pale earth and stone, sparse bracken and scrub, a shallow stony brook winding through exposed ground, wide sky and distant muted hills, no structures, no ruins, no paths, the land feeling old and empty. Quiet, expectant, cold, wind sighing across the plain, no birdsong, dramatic but subdued lighting with cool light and soft shadows, depth fading into misty distance. The full Fellowship of nine as small figures in the landscape, cloaks drawn against the wind, moving together across the open land. High detail, museum quality, square format, no text, no watermarks, no borders. |  |
| 43 | 638 | Rolling Lands | 43 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, rolling lands of Hollin with treeless ridges like waves, withered bracken and scattered stones under a wide open sky, the white peak of Caradhras visible ahead in the distance. Bleak, windy, empty, cold air with a sense of watchfulness, dramatic light breaking through clouds yet subdued by the chill. The full Fellowship of nine appears as small figures in the landscape; Gandalf leading at the front, Aragorn slightly apart scanning the sky. High detail, museum quality, square format, no text, no watermarks, no borders. |  |
| 44 | 668 | Land drops more steeply, go Southeast into a valley | 44 | missing-both | Watercolour painting in the style of Alan Lee and John Howe, wet-on-wet washes with soft edges, visible brushwork, textured paper, limited palette, square format. Rugged red lands of Hollin under a pale clear sun; the land drops steeply into a sheltered valley with bare slopes and sparse scrub. Atmospheric perspective shows the ancient emptiness and distance, dramatic light falling into the valley where the wind is less biting. The full Fellowship of nine appears as small figures; Aragorn leads at the front, the others following in a tight line across the slope. Emphasize scale and isolation, with the figures dwarfed by the landscape. No text, no watermark, no border. |  |
| 47 | 690 | Top of Hollin Ridge. Crebain fly over. - Boarder of Eregion | 47 | missing-both | Watercolour painting, wet-on-wet technique, soft diffused edges, visible brushwork, atmospheric perspective, textured paper, in the style of Alan Lee and John Howe, the top of Hollin Ridge: an open treeless moor of heather and red stone, shallow hollows and low rises, a broad wind-swept ridge under a wide sky; crebain, dark crows, wheel overhead with rushing wings. Sudden tension in the air, exposed and uneasy, cold wind, fear and stillness, dramatic overcast light with muted contrast and a limited palette. The full Fellowship of nine as small figures in the landscape, huddled low into the hollows and heather; Sam alert and looking up, Legolas indicating the birds, Aragorn signaling them to hide, postures tense and cautious. High detail, museum quality, square format, no text, no watermarks, no borders. |  |
| 50 | 742 | Almost at the foot of the Redhorn. Gandalf and Aragorn debate the path. Fearing snow everyone carries wood | 50 | missing-both |  |  |
| 55 | 818 | Reach junction of 3 passages with guardroom | 55 | missing-both |  |  |
| 60 | 906 | Reach the hill of Cerin Amroth | 60 | missing-both |  |  |
| 64 | 987 | Camp on west bank of river | 64 | missing-both |  |  |
| 66 | 1023 | Camp on flats north of the Field of Celebrant | 66 | missing-both |  |  |
| 71 | 1083 | Camp on small eyot near western shore. Sam and Frodo watch. Gollum appears during Frodo’s watch. Aragorn wakes. Watches until morning | 71 | missing-both |  |  |
| 72 | 1122 | North edge of eastern South Undeep | 72 | missing-both |  |  |
| 73 | 1142 | Reach the north edge of western South Undeep | 73 | missing-both |  |  |
| 74 | 1155 | CAMP during DAY (Feb. 21). Downs on both sides of the river | 74 | missing-both |  |  |
| 76 | 1205 | CAMP during DAY (Feb. 22) | 76 | missing-both |  |  |
| 78 | 1234 | They reach the higher Emyn Muil | 78 | missing-both |  |  |
| 79 | 1255 | Camp on west shore (Feb. 23). Many birds circle during the day. Late in day Legolas sees eagle. Wait to full dark to leave (8:30 p.m.). Go slowly | 79 | missing-both |  |  |
| 81 | 1269 | Foggy. Carry boats and packs to foot of rapids – 2 trips. Camp by pool that night | 81 | missing-both |  |  |
| 82 | 1288 | The Argonath. Boats are swept through the narrow gap between | 82 | missing-both |  |  |
| 83 | 1290 | Pass out of the chasm into the lake: Nen Hithoel. (ca. 2 p.m.) | 83 | missing-both |  |  |
| 84 | 1309 | Reach the lawn of Parth Galen below Amon Hen. “Rauros was calling with a great voice.” Camp there | 84 | missing-both |  |  |
| 85 | 1341 | The Wetwang curves south | 85 | missing-both |  |  |
| 88 | 1463 | Reach the Desolation of the Morannon | 88 | missing-both |  |  |
| 89 | 1499 | Reach northern edge of Ithilien | 89 | missing-both |  |  |
| 94 | 1698 | Out on the plain, drawing near Isenmouthe | 94 | missing-both |  |  |
| 95 | 1755 | The Dreadful Nightfall | 95 | missing-both |  |  |
| 96 | 1779 | Destroy the ring in Mount Doom | 96 | missing-both |  |  |
| 97 | 1798 | Camp along the road | 97 | missing-both |  |  |
| 98 | 1835 | Camp near Henneth Annûn | 98 | missing-both |  |  |
| 99 | 1840 | Continue on Southward Road | 99 | missing-both |  |  |
| 100 | 1863 | Can see Amon Dîn due west | 100 | missing-both |  |  |
| 102 | 1899 | Reach the Gates of Minas Tirith | 102 | missing-both |  |  |
| 103 | 1949 | Camp by road north of the Drúadan Forest | 103 | missing-both |  |  |
| 104 | 2000 | Pass the beacon on Nardol, the “Fire Hill” | 104 | missing-both |  |  |
| 105 | 2051 | The beacon hill of Minrimmon is on the left | 105 | missing-both |  |  |
| 106 | 2080 | The beacon tower of Calenhad stands on a foothill of Calenhad peak | 106 | missing-both |  |  |
| 107 | 2166 | North of the road, is the Entwash | 107 | missing-both |  |  |
| 108 | 2206 | Leave the Folde | 108 | missing-both |  |  |
| 112 | 2378 | Reach Helm’s Deep | 112 | missing-both |  |  |
| 113 | 2434 | Treegarth of Orthanc, Isengard is no more | 113 | missing-both |  |  |
| 115 | 2509 | Camp by a small stream | 115 | missing-both |  |  |
| 116 | 2539 | Camp at base of an out-thrust hill of Methedras | 116 | missing-both |  |  |
| 117 | 2569 | Reach the remains of the roadway to Tharbad | 117 | missing-both |  |  |
| 125 | 2874 | Reach the hill where the Fellowship had sheltered from the Warg attack | 125 | missing-both |  |  |
| 126 | 2909 | Open country. Gentle slopes, easier for the ponies | 126 | missing-both |  |  |
| 127 | 2959 | Camp atop Hollin Ridge among the large smooth towering rocks | 127 | missing-both |  |  |
| 129 | 3049 | Climb northeast up a slope. In the west, the marsh ends | 129 | missing-both |  |  |
| 131 | 3099 | Turn slightly west of north | 131 | missing-both |  |  |
| 132 | 3127 | Reach the Last Homely House | 132 | missing-both |  |  |
| 134 | 3156 | Bruinen turns more to the south | 134 | missing-both |  |  |
| 135 | 3185 | Reach pathway to Stone Trolls | 135 | missing-both |  |  |
| 136 | 3199 | Cross The Last Bridge | 136 | missing-both |  |  |
| 141 | 3294 | Land rises slowly toward Hills | 141 | missing-both |  |  |
| 142 | 3324 | Weathertop immediately north of road | 142 | missing-both |  |  |
| 144 | 3391 | Camp. Marshes farther north from the road | 144 | missing-both |  |  |
| 148 | 3479 | Reach the Brandywine Bridge | 148 | missing-both |  |  |
| 149 | 3501 | Frogmorton | 149 | missing-both |  |  |
| 152 | 3561 | Reach the point where the road splits | 152 | missing-both |  |  |
| 153 | 3626 | Pass south of Tuckburrow | 153 | missing-both |  |  |
| 154 | 3614 | Camp in the open lands | 154 | missing-both |  |  |
| 157 | 3684 | Can see the Tower Hills on the western horizon | 157 | missing-both |  |  |
| 158 | 3704 | Land begins to rise toward the Tower Hills | 158 | missing-both |  |  |
| 159 | 3724 | Reach the Great East Road | 159 | missing-both |  |  |
| 161 | 3764 | Land drops gently down toward the Gulf | 161 | missing-both |  |  |
| 162 | 3784 | Say farewell. The White Ship sails Into the West | 162 | missing-both |  |  |
| 165 | 3864 | Ahead to the east, see the crest of the Far Downs | 165 | missing-both |  |  |
| 166 | 3884 | Reach the steep western face of the Far Downs | 166 | missing-both |  |  |
| 171 | 3991 | Sam arrives at Bag End at sunset: Home | 171 | missing-both |  |  |
| 172 | 435 | Camp under Glorfindel's Watch | NULL | missing-both |  |  |
| 173 | 883.5 | Camp in the Naith of Lórien | NULL | missing-both |  |  |
| 174 | 1555 | Camp under the holm-oaks in Ithilien | NULL | missing-both |  |  |
| 175 | 1675 | Camp within sight of the fortress of Durthang | NULL | missing-both |  |  |
| 176 | 1717 | Frodo and Sam cast away their orc-gear | NULL | missing-both |  |  |
| 177 | 1924 | Camp in the green lands of Anórien | NULL | missing-both |  |  |
| 178 | 1975 | Pass the beacon hill of Eilenach | NULL | missing-both |  |  |
| 179 | 2025 | Pass the beacon hill of Erelas | NULL | missing-both |  |  |
| 180 | 2124 | Pass the beacon of Halifirien and the Firien Wood | NULL | missing-both |  |  |
| 181 | 2230 | Camp in the King's Lands | NULL | missing-both |  |  |
| 182 | 2295 | Camp in the Westfold | NULL | missing-both |  |  |
| 183 | 2410 | Halt at the Fords of Isen | NULL | missing-both |  |  |
| 184 | 2455 | Cross the River Isen | NULL | missing-both |  |  |
| 185 | 2651 | Camp among the wide grassy swells | NULL | missing-both |  |  |
| 186 | 2696 | Pass the ruins of an ancient causeway | NULL | missing-both |  |  |
| 187 | 2784 | Camp in the quiet land of Hollin | NULL | missing-both |  |  |
| 188 | 2934 | The Mountains of Moria loom ahead | NULL | missing-both |  |  |
| 189 | 2987 | Camp in the shadow of the Three Peaks | NULL | missing-both |  |  |
| 190 | 3588 | Travel through the Green Hill Country | NULL | missing-both |  |  |

---

## Methodology

1. Queried the local D1 SQLite database used by Wrangler (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`).
2. Pulled all goals and their `image_id` values from the `goals` table.
3. Checked for the existence of:
   - `public/img/highres/{image_id}.jpg` or `public/img/highres/{image_id}.webp`
   - `public/img/thumbs/{image_id}-thumb.jpg`
4. Marked any goal missing either required image as missing.

---

## Notes

- WEBP images count as valid highres images.