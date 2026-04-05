/*
  # Add Mock Crew Profiles And Assignment Support

  ## Overview
  Enables companies to create unsigned crew profiles and assign them to schedules.

  ## Changes
  - Adds `mock_crew_profiles` table.
  - Extends `job_assignments` to support either `user_id` OR `mock_crew_profile_id`.
  - Adds overlap checks and RLS support for mock assignees.
  - Skips assignment notifications when the assignment is for a mock profile.
*/

CREATE TABLE IF NOT EXISTS public.mock_crew_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role public.app_role NOT NULL DEFAULT 'crew_member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_crew_profiles_role_check CHECK (role IN ('crew_lead', 'crew_member'))
);

CREATE INDEX IF NOT EXISTS idx_mock_crew_profiles_account_id
ON public.mock_crew_profiles(account_id);

CREATE INDEX IF NOT EXISTS idx_mock_crew_profiles_account_name
ON public.mock_crew_profiles(account_id, full_name);

DROP TRIGGER IF EXISTS update_mock_crew_profiles_updated_at ON public.mock_crew_profiles;
CREATE TRIGGER update_mock_crew_profiles_updated_at
  BEFORE UPDATE ON public.mock_crew_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.mock_crew_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Account members can view mock crew profiles"
  ON public.mock_crew_profiles
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id
      FROM public.account_members am
      WHERE am.user_id = auth.uid()
      AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "Managers can create mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Managers can create mock crew profiles"
  ON public.mock_crew_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_user_account_manager(account_id, auth.uid()));

DROP POLICY IF EXISTS "Managers can update mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Managers can update mock crew profiles"
  ON public.mock_crew_profiles
  FOR UPDATE
  TO authenticated
  USING (is_user_account_manager(account_id, auth.uid()))
  WITH CHECK (is_user_account_manager(account_id, auth.uid()));

DROP POLICY IF EXISTS "Managers can delete mock crew profiles" ON public.mock_crew_profiles;
CREATE POLICY "Managers can delete mock crew profiles"
  ON public.mock_crew_profiles
  FOR DELETE
  TO authenticated
  USING (is_user_account_manager(account_id, auth.uid()));

ALTER TABLE public.job_assignments
ADD COLUMN IF NOT EXISTS mock_crew_profile_id uuid REFERENCES public.mock_crew_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.job_assignments
ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_assignments_mock_crew_profile_id
ON public.job_assignments(mock_crew_profile_id);

DROP INDEX IF EXISTS public.job_assignments_schedule_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_schedule_user_unique
ON public.job_assignments(job_schedule_id, user_id)
WHERE job_schedule_id IS NOT NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_schedule_mock_unique
ON public.job_assignments(job_schedule_id, mock_crew_profile_id)
WHERE job_schedule_id IS NOT NULL AND mock_crew_profile_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_assignments_single_assignee_check'
    AND conrelid = 'public.job_assignments'::regclass
  ) THEN
    ALTER TABLE public.job_assignments
    ADD CONSTRAINT job_assignments_single_assignee_check
    CHECK (((user_id IS NOT NULL)::int + (mock_crew_profile_id IS NOT NULL)::int) = 1);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_mock_profile_in_account(p_mock_profile_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mock_crew_profiles mcp
    WHERE mcp.id = p_mock_profile_id
    AND mcp.account_id = p_account_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_assignment_overlap(
  p_user_id uuid,
  p_schedule_id uuid,
  p_account_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      JOIN public.job_schedules js1 ON ja.job_schedule_id = js1.id
      JOIN public.job_schedules js2 ON js2.id = p_schedule_id
      WHERE ja.user_id = p_user_id
      AND ja.account_id = p_account_id
      AND js1.scheduled_date = js2.scheduled_date
      AND (
        (js1.scheduled_time_start IS NULL OR js2.scheduled_time_start IS NULL)
        OR (
          js1.scheduled_time_start < js2.scheduled_time_end
          AND js1.scheduled_time_end > js2.scheduled_time_start
        )
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.check_mock_assignment_overlap(
  p_mock_profile_id uuid,
  p_schedule_id uuid,
  p_account_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN p_mock_profile_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      JOIN public.job_schedules js1 ON ja.job_schedule_id = js1.id
      JOIN public.job_schedules js2 ON js2.id = p_schedule_id
      WHERE ja.mock_crew_profile_id = p_mock_profile_id
      AND ja.account_id = p_account_id
      AND js1.scheduled_date = js2.scheduled_date
      AND (
        (js1.scheduled_time_start IS NULL OR js2.scheduled_time_start IS NULL)
        OR (
          js1.scheduled_time_start < js2.scheduled_time_end
          AND js1.scheduled_time_end > js2.scheduled_time_start
        )
      )
    )
  END;
$$;

DROP POLICY IF EXISTS "Managers can create job assignments" ON public.job_assignments;
CREATE POLICY "Managers can create job assignments"
  ON public.job_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_account_manager(account_id, auth.uid())
    AND (lead_id IS NULL OR is_lead_in_account(lead_id, account_id))
    AND (job_schedule_id IS NULL OR is_schedule_in_account(job_schedule_id, account_id))
    AND (
      (
        user_id IS NOT NULL
        AND mock_crew_profile_id IS NULL
        AND is_user_in_account(user_id, account_id)
        AND (
          job_schedule_id IS NULL
          OR NOT check_assignment_overlap(user_id, job_schedule_id, account_id)
        )
      )
      OR
      (
        user_id IS NULL
        AND mock_crew_profile_id IS NOT NULL
        AND is_mock_profile_in_account(mock_crew_profile_id, account_id)
        AND (
          job_schedule_id IS NULL
          OR NOT check_mock_assignment_overlap(mock_crew_profile_id, job_schedule_id, account_id)
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.notify_job_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead_name text;
  _prefs jsonb;
  _alert_enabled boolean;
  _target_user_id uuid;
  _target_account_id uuid;
  _target_lead_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _target_user_id := NEW.user_id;
    _target_account_id := NEW.account_id;
    _target_lead_id := NEW.lead_id;
  ELSIF TG_OP = 'DELETE' THEN
    _target_user_id := OLD.user_id;
    _target_account_id := OLD.account_id;
    _target_lead_id := OLD.lead_id;
  END IF;

  IF _target_user_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  SELECT name INTO _lead_name FROM public.leads WHERE id = _target_lead_id;

  SELECT notification_preferences INTO _prefs
  FROM public.profiles WHERE user_id = _target_user_id;

  _alert_enabled := true;
  IF _prefs IS NOT NULL
     AND _prefs->'alerts' IS NOT NULL
     AND _prefs->'alerts'->'job_assignments' IS NOT NULL THEN
    _alert_enabled := (_prefs->'alerts'->>'job_assignments')::boolean;
  END IF;

  IF _alert_enabled THEN
    INSERT INTO public.notifications (account_id, user_id, title, body, event_type, reference_id, reference_type)
    VALUES (
      _target_account_id,
      _target_user_id,
      CASE WHEN TG_OP = 'INSERT' THEN 'Job Assignment' ELSE 'Job Unassigned' END,
      CASE WHEN TG_OP = 'INSERT'
        THEN 'You have been assigned to ' || COALESCE(_lead_name, 'a job')
        ELSE 'You have been removed from ' || COALESCE(_lead_name, 'a job')
      END,
      'job_assignment',
      _target_lead_id,
      'lead'
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  ELSE
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_sms_job_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _lead_name text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _lead_name FROM public.leads WHERE id = NEW.lead_id;

  PERFORM net.http_post(
    url := 'https://knjbakdhjspftwqrzzcl.supabase.co/functions/v1/send-sms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event_type', 'job_assignments',
      'account_id', NEW.account_id::text,
      'data', jsonb_build_object(
        'lead_id', NEW.lead_id::text,
        'lead_name', COALESCE(_lead_name, 'Job'),
        'user_id', NEW.user_id::text,
        'action', 'assigned'
      )
    )
  );
  RETURN NEW;
END;
$$;

