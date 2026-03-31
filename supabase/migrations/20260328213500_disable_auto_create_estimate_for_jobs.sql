/*
  # Disable automatic estimate creation for new jobs

  ## Why
  Estimates should only be created manually from the Build Estimate action.
  Jobs created from the job modal or by scheduling a lead should not receive
  an automatic draft estimate.

  ## Behavior
  - Keep the existing trigger in place but make its function a no-op.
  - Existing estimates linked to leads/jobs remain unchanged.
*/

CREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;
