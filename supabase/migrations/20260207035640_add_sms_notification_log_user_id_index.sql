/*
  # Add missing foreign key index on sms_notification_log

  1. New Indexes
    - `idx_sms_notification_log_user_id` on `sms_notification_log(user_id)` to cover the foreign key

  2. Notes
    - Missing FK index can cause slow joins and cascading deletes
*/

CREATE INDEX IF NOT EXISTS idx_sms_notification_log_user_id
  ON public.sms_notification_log (user_id);
