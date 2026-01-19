/*
  # Remove fit_score Column from Lead Qualifications

  ## Overview
  Removes the fit_score column from lead_qualifications table since it's now calculated
  dynamically in the application rather than stored in the database.

  ## Changes
  1. Drop the fit_score column from lead_qualifications table

  ## Notes
  - Fit score is now calculated based on:
    - budget_confirmed (30 points)
    - service_area_fit (30 points)
    - decision_maker_confirmed (25 points)
    - timeline (5-15 points based on urgency)
*/

-- Drop fit_score column as it's calculated dynamically
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_qualifications' AND column_name = 'fit_score'
  ) THEN
    ALTER TABLE lead_qualifications DROP COLUMN fit_score;
  END IF;
END $$;
