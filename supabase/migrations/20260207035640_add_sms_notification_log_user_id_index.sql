/*\n  # Add missing foreign key index on sms_notification_log\n\n  1. New Indexes\n    - `idx_sms_notification_log_user_id` on `sms_notification_log(user_id)` to cover the foreign key\n\n  2. Notes\n    - Missing FK index can cause slow joins and cascading deletes\n*/\n\nCREATE INDEX IF NOT EXISTS idx_sms_notification_log_user_id\n  ON public.sms_notification_log (user_id);
\n;
