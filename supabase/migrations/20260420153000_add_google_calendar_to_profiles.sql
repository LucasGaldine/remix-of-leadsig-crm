/*
  # Add per-user Google Calendar settings

  Moves calendar integration credentials to `profiles` so each user connects
  their own Google account independently from company-wide settings.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_calendar jsonb;

WITH member_calendars AS (
  SELECT
    am.user_id,
    a.settings -> 'google_calendar' AS google_calendar,
    ROW_NUMBER() OVER (PARTITION BY am.user_id ORDER BY am.created_at ASC) AS rn
  FROM public.account_members am
  JOIN public.accounts a ON a.id = am.account_id
  WHERE am.is_active = true
    AND COALESCE(a.settings, '{}'::jsonb) ? 'google_calendar'
    AND COALESCE((a.settings -> 'google_calendar' ->> 'connected')::boolean, false) = true
)
UPDATE public.profiles p
SET
  google_calendar = mc.google_calendar,
  updated_at = NOW()
FROM member_calendars mc
WHERE p.user_id = mc.user_id
  AND mc.rn = 1
  AND p.google_calendar IS NULL;
