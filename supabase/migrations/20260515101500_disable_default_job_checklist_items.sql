/*
  # Disable automatic checklist item creation on job conversion

  1. Changes
    - Update `create_default_checklist_items` trigger function.
    - Stop inserting any default checklist items when a lead becomes a job.
*/

CREATE OR REPLACE FUNCTION create_default_checklist_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
