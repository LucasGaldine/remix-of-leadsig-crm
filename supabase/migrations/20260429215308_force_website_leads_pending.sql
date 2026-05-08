CREATE OR REPLACE FUNCTION public.enforce_website_lead_pending_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.source, '')) IN ('website', 'website_form', 'site') THEN
    NEW.approval_status := 'pending';
    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
    NEW.approved_at := NULL;
    NEW.approval_reason := NULL;
    NEW.rejected_at := NULL;
    NEW.approved_by_user_id := NULL;
    NEW.rejected_by_user_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_website_lead_pending_approval ON public.leads;

CREATE TRIGGER trg_enforce_website_lead_pending_approval
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_website_lead_pending_approval();;
