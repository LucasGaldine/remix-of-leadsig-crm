-- Disable notifications and automated messaging capabilities for Free-plan accounts.
-- This backfills existing data so UI + edge-function guards start from a safe default.

UPDATE public.accounts
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{job_message_automation}',
  (
    COALESCE(settings->'job_message_automation', '{}'::jsonb)
    || jsonb_build_object(
      'enabled', false,
      'message_template', '',
      'message_templates', '[]'::jsonb,
      'job_service_types', '[]'::jsonb,
      'endpoint',
        COALESCE(settings->'job_message_automation'->'endpoint', '{}'::jsonb)
        || jsonb_build_object(
          'enabled', false,
          'url', '',
          'auth_header_name', '',
          'auth_header_value', ''
        ),
      'payment_emails', jsonb_build_object(
        'estimate_approved', false,
        'invoice_sent', false,
        'payment_logged', false
      )
    )
  ),
  true
),
updated_at = now()
WHERE pricing_plan = 'free';

WITH free_only_users AS (
  SELECT DISTINCT am.user_id
  FROM public.account_members am
  JOIN public.accounts a
    ON a.id = am.account_id
  WHERE am.is_active = true
    AND a.pricing_plan = 'free'
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_members am2
      JOIN public.accounts a2
        ON a2.id = am2.account_id
      WHERE am2.user_id = am.user_id
        AND am2.is_active = true
        AND a2.pricing_plan <> 'free'
    )
)
UPDATE public.profiles p
SET mention_notifications_enabled = false,
    sms_consent_status = 'opted_out',
    notification_preferences =
      COALESCE(p.notification_preferences, '{}'::jsonb)
      || jsonb_build_object(
        'channels', jsonb_build_object('push', false, 'email', false, 'sms', false),
        'alerts', jsonb_build_object(
          'new_leads', false,
          'lead_updates', false,
          'payments', false,
          'schedule_changes', false,
          'tasks', false,
          'job_assignments', false,
          'same_day_reminders', false
        ),
        'email_events', jsonb_build_object(
          'estimate_approved', false,
          'invoice_sent', false,
          'payment_logged', false
        ),
        'digest', jsonb_build_object('frequency', 'off'),
        'quiet_hours', jsonb_build_object('enabled', false, 'start', '21:00', 'end', '07:00')
      )
WHERE p.user_id IN (SELECT user_id FROM free_only_users);
