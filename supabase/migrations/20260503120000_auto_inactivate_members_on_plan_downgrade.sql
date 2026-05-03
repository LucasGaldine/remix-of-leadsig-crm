-- Preserve account memberships on plan downgrades by deactivating excess members.
-- This avoids deleting members when moving to plans with lower seat limits.

ALTER TABLE public.account_members
ADD COLUMN IF NOT EXISTS inactive_reason text;

CREATE OR REPLACE FUNCTION public.enforce_account_member_limit_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  target_member_cap integer := null;
  keep_member_ids uuid[] := ARRAY[]::uuid[];
  deactivation_reason text;
BEGIN
  IF NEW.pricing_plan = OLD.pricing_plan
     AND COALESCE(NEW.pricing_tier, '') = COALESCE(OLD.pricing_tier, '') THEN
    RETURN NEW;
  END IF;

  IF NEW.pricing_plan = 'free' THEN
    target_member_cap := 1;
  ELSIF NEW.pricing_plan = 'basic' THEN
    IF NEW.pricing_tier = 'solo' THEN
      target_member_cap := 1;
    ELSIF NEW.pricing_tier = 'team' THEN
      target_member_cap := 5;
    ELSE
      target_member_cap := null;
    END IF;
  ELSE
    target_member_cap := null;
  END IF;

  IF target_member_cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(member_id)
  INTO keep_member_ids
  FROM (
    SELECT am.id AS member_id
    FROM public.account_members am
    WHERE am.account_id = NEW.id
      AND am.is_active = true
    ORDER BY
      CASE am.role::text
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'sales' THEN 2
        WHEN 'crew_member' THEN 3
        ELSE 4
      END,
      COALESCE(am.joined_at, am.created_at),
      am.created_at,
      am.id
    LIMIT target_member_cap
  ) ranked_members;

  deactivation_reason := 'Inactive due to plan downgrade: ' || NEW.pricing_plan
    || COALESCE(' (' || NEW.pricing_tier || ')', '')
    || ' allows only ' || target_member_cap::text
    || CASE WHEN target_member_cap = 1 THEN ' active member' ELSE ' active members' END
    || '.';

  UPDATE public.account_members
  SET is_active = false,
      inactive_reason = deactivation_reason,
      updated_at = now()
  WHERE account_id = NEW.id
    AND is_active = true
    AND (
      keep_member_ids IS NULL
      OR NOT (id = ANY(keep_member_ids))
    );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_account_member_limit_on_plan_change_trigger ON public.accounts;
CREATE TRIGGER enforce_account_member_limit_on_plan_change_trigger
AFTER UPDATE OF pricing_plan, pricing_tier ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_account_member_limit_on_plan_change();
