-- Migration 0169_add_daily_roll_outcome.sql
-- Records what each finalized daily roll actually produced so a probability
-- miss, an eligibility rejection, and a successful offer are distinguishable
-- in operations. `outcome` is authoritative for diagnosis; the legacy `status`
-- column remains the accept/decline lifecycle field.
--
-- The default exists for rolling-deploy compatibility: the previous Worker can
-- insert a roll without naming `outcome` after this migration is applied. New
-- Worker code always supplies an explicit outcome. Pre-migration rows whose
-- historical cause cannot be reconstructed stay `legacy_unknown`.

ALTER TABLE daily_rolls ADD COLUMN outcome TEXT NOT NULL DEFAULT 'legacy_unknown'
    CHECK (outcome IN (
        'offer',
        'probability_miss',
        'insufficient_activity',
        'active_challenge',
        'no_definition',
        'legacy_unknown'
    ));

-- A stored definition and preview target prove the roll produced an offer,
-- regardless of whether the user later accepted or declined it.
UPDATE daily_rolls
SET outcome = 'offer'
WHERE encounter_definition_id IS NOT NULL
  AND preview_target_distance IS NOT NULL;
