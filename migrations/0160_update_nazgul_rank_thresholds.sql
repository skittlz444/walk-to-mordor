-- Migration 0160_update_nazgul_rank_thresholds.sql
-- Repair databases that already applied the original 0158 seed with the
-- previous, lower rank thresholds before they changed to [1,3,7,15].
-- INSERT OR IGNORE in 0158 leaves an existing row untouched, so the seed
-- rewrite alone cannot update already-seeded databases. This UPDATE is
-- idempotent and safe when the row is absent (it simply updates 0 rows).

UPDATE achievement_definitions
SET metadata = '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"pursuits","criteria":"personal_encounter_completed"}',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'challenge-nazgul-outrun';
