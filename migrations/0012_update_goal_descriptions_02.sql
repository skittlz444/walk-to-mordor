-- Migration number: 0012 	 2026-01-12T00:00:00.000Z

-- Batch 02: Update goal descriptions for improved accuracy

-- Goal: Following a wide shallow curving valley (Distance: 298)
UPDATE goals SET description = 'The travellers descend from the broken hills into a wide, shallow valley that winds its way through the desolate Lone-lands. The ancient road is gone, swallowed by the earth, yet Strider finds a faint, forgotten track that leads them onward under a grey and cheerless sky. Ruins of stone walls and crumbled towers look down from the ridges, silent memorials of a kingdom lost to the north. Through this empty landscape they trudge, the silence broken only by the pony''s hooves, as Frodo fights the spreading cold of his wound.' WHERE distance = 298 * 1.60934;

-- Goal: Continuing in valley (Distance: 328)
UPDATE goals SET description = 'For days the company trudges through the same dreary, shallow valley, a landscape sketched in shades of grey and brown under a weeping sky. The cheerless miles of the Lone-lands stretch on seemingly without end, offering no shelter and little hope to the weary company. Frodo''s strength wanes with each step, the chill of the Morgul-wound seeping deeper despite the efforts of Sam and Strider to keep him warm. Though the Black Riders have not been seen since Weathertop, a heavy dread hangs over the trail, driving them relentlessly eastward towards the loud rushing of the Hoarwell.' WHERE distance = 328 * 1.60934;

-- Goal: Cross the Last Bridge (Distance: 358)
UPDATE goals SET description = 'After days of anxious travel through the Lone-lands, the company finally reaches the Last Bridge, a stone arch spanning the deep, rushing waters of the Hoarwell. To their immense relief, the bridge stands silent and unguarded, though Strider cautiously scouts for any sign of an ambush. Upon the bridge, he discovers a single pale-green beryl, an elf-stone left as a token by Glorfindel to mark his passing and signal that the way is clear. Hurrying across the span, they left the barren lands behind and entered the Trollshaws, though the shadow of the Black Riders still pressed heavily on their minds as Frodo''s strength continued to fade.' WHERE distance = 358 * 1.60934;

-- Goal: Meet Mr. Bilbo's Trolls (Distance: 392)
UPDATE goals SET description = 'Venturing off the road into the wooded hills of the Trollshaws, the company stumbled upon a glade occupied by three enormous, moss-covered figures. These were the very trolls—Bert, Tom, and William—that Bilbo Baggins had outwitted decades ago, now frozen forever in stone by the light of dawn. The sight brought a rare moment of levity to the weary travellers, prompting Sam to recite a rhyme about stone trolls as they marveled at this relic of the older hobbit''s adventures. Yet even here, the respite was brief, for the path ahead grew ever more perilous as the chill of Frodo''s wound deepened.' WHERE distance = 392 * 1.60934;

-- Goal: Meet Glorfindel (Distance: 405)
UPDATE goals SET description = 'Strider and the hobbits halted at the sound of approaching hooves, fearing the Black Riders had found them again. Instead of a dark shadow, a golden light revealed Glorfindel, an elf-lord from Rivendell, riding a white horse. He spoke urgent words to the Ranger, warning that the Nine were closing in from behind. The elf''s presence brought a moment of hope to the weary travellers as they hastened their pace toward the safety of the river.' WHERE distance = 405 * 1.60934;

-- Goal: Attacked by Nazgul at the Ford of Bruinen (Distance: 450)
UPDATE goals SET description = 'Frodo, seated atop the elf-horse Asfaloth, fled desperately toward the Ford of Bruinen with the Black Riders in pursuit. The shrieking Wraiths commanded him to halt, but he defied them from the far bank, his sword drawn in a final act of courage. As the Nine Riders entered the water to claim him, the river suddenly rose in a mighty flood, shaped like crashing white horses, sweeping the enemy away. Exhaustion finally overcame the Ring-bearer as darkness took his sight.' WHERE distance = 450 * 1.60934;

-- Goal: Reach Imladris (Rivendell) (Distance: 458)
UPDATE goals SET description = 'The Ring-bearer awoke to the sound of simple, clear bells and the smell of pine trees. He found himself lying in a soft bed within the Last Homely House, healed by the skill of Elrond. Reunions with Sam, Merry, and Pippin brought great joy, and even Bilbo was found sitting by a small fire. In this house of peace, the shadow of the journey seemed momentarily lifted, replaced by songs and tales of old.' WHERE distance = 458 * 1.60934;

-- Goal: Reach Ford of Bruinen (Distance: 466)
UPDATE goals SET description = 'The Fellowship of the Ring set out from the house of Elrond on a cold, grey morning, nine walkers against the nine riders of the enemy. They climbed the steep paths leading out of the hidden valley, leaving the comfort of Imladris behind. Looking back, the Ford of Bruinen appeared far below, now calm and quiet under the winter sky. They turned their faces south, embarking on the long road that led towards the fire.' WHERE distance = 466 * 1.60934;

-- Goal: Walk through a steep-sided canyon (Distance: 480)
UPDATE goals SET description = 'The travellers moved silently through a deep, steep-sided canyon that cut through the lower lands. High rocky walls rose on either side, casting long shadows that kept the sun from their path. The ground was rough and broken, forcing the Company to walk in single file with Aragorn leading the way. The only sound was the crunch of their boots on loose stone and the wind sighing high above.' WHERE distance = 480 * 1.60934;

-- Goal: Cross a small stream (Distance: 484)
UPDATE goals SET description = 'The Fellowship came upon a small, swift-flowing stream that cut across their path, fed by the distant mountains. The water was icy cold as they stepped across the slick stones, a reminder of the winter taking hold of the wild. Legolas paused briefly to listen to the water''s song, but the others pressed on without delay. There was no shelter here, and the open land made them feel exposed to watching eyes.' WHERE distance = 484 * 1.60934;

-- Goal: Reach the top of a small hill, there are snow-capped peaks due East (Distance: 504)
UPDATE goals SET description = 'The nine companions crested a small, barren hill and paused to survey the land ahead. Due East, the jagged line of the Misty Mountains rose up, their peaks capped with white snow against the pale sky. The sight was daunting to the hobbits, who knew they must eventually climb those freezing heights. Gandalf studied the horizon with a grim expression, choosing their path carefully through the rough country.' WHERE distance = 504 * 1.60934;

-- Goal: Reach a small stream, follow it west (Distance: 516)
UPDATE goals SET description = 'Aragorn led the group down into a shallow depression where another small stream wound its way through the withered heather. Instead of crossing, they followed the water''s course westward for a time to mask their trail from spies. The gurgling water covered the sound of their footsteps, though the hobbits struggled to keep their footing on the muddy banks. Every mile gained felt like a small victory against the growing weight of the road.' WHERE distance = 516 * 1.60934;

-- Goal: Reached the top of a rise, heading Southeast (Distance: 528)
UPDATE goals SET description = 'The party ceased their westward diversion and scrambled up to the top of a rugged rise. Gandalf pointed his staff Southeast, correcting their course back towards the Redhorn Gate. The land rolled out before them in bleak waves of brown and grey, empty of life but full of hidden peril. With a heavy sigh, Sam adjusted his pack, and they began the descent, marching steadily into the gathering gloom.' WHERE distance = 528 * 1.60934;

