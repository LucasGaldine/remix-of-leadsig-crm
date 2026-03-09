/*
  # Make leads name column nullable

  ## Problem
  When creating a job through the "Create Job" modal, users can optionally provide a job name.
  However, the `leads.name` column has a NOT NULL constraint, causing an error when creating
  jobs without a name.

  ## Solution
  Make the `leads.name` column nullable to allow jobs to be created without a name.

  ## Changes
  1. Remove NOT NULL constraint from `leads.name` column

  ## Important Notes
  - Job names are optional in the UI
  - Many jobs may not need a custom name (e.g., "Lawn Mowing" service type is sufficient)
  - This allows flexibility for users to add names only when needed
*/

-- Make leads.name nullable
ALTER TABLE leads 
ALTER COLUMN name DROP NOT NULL;

-- Update column comment
COMMENT ON COLUMN leads.name IS 'Optional custom name for the lead/job. If not provided, service type or customer info can be used for display.';
