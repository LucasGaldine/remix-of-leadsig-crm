/*
  # Fix mutable search_path on trigger functions

  1. Security Changes
    - Set explicit `search_path = public` on 9 trigger functions
    - Prevents search_path injection attacks

  2. Affected Functions
    - notify_sms_new_lead
    - notify_sms_payment
    - notify_sms_schedule_change
    - notify_sms_lead_update
    - notify_new_lead
    - notify_lead_status_change
    - notify_payment_received
    - notify_job_scheduled
    - notify_estimate_approved
*/

ALTER FUNCTION public.notify_sms_new_lead() SET search_path = public;
ALTER FUNCTION public.notify_sms_payment() SET search_path = public;
ALTER FUNCTION public.notify_sms_schedule_change() SET search_path = public;
ALTER FUNCTION public.notify_sms_lead_update() SET search_path = public;
ALTER FUNCTION public.notify_new_lead() SET search_path = public;
ALTER FUNCTION public.notify_lead_status_change() SET search_path = public;
ALTER FUNCTION public.notify_payment_received() SET search_path = public;
ALTER FUNCTION public.notify_job_scheduled() SET search_path = public;
ALTER FUNCTION public.notify_estimate_approved() SET search_path = public;
