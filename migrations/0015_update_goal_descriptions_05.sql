-- Migration number: 0015 	 2026-01-12T00:00:01.000Z

-- Batch 05: Update goal descriptions for improved accuracy

-- Goal: Hills also appear on the west. The river passes through “low crumbling cliffs, and chimneys with grey weathered stone dark with ivy” (Distance: 1220)
UPDATE goals SET description = 'The Company continued their journey down the Anduin, noticing that the open lands were giving way to distinct rising ground on the western shore. Their boats drifted past low crumbling cliffs and strange natural chimneys of grey weathered stone, which loomed dark with curtains of ivy. This change in the landscape marked the beginning of the stony highlands of the Emyn Muil, closing in on the river from both sides. For Frodo and his companions, the narrowing banks brought a fresh sense of foreboding as the Great River quickened its pace towards the uncertain rapids ahead.' WHERE distance = 1220 * 1.60934;
