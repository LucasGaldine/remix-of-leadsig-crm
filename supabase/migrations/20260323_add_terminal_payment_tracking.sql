ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS payment_channel text,
  ADD COLUMN IF NOT EXISTS stripe_terminal_reader_id text,
  ADD COLUMN IF NOT EXISTS stripe_terminal_location_id text,
  ADD COLUMN IF NOT EXISTS stripe_terminal_payment_intent_status text;
