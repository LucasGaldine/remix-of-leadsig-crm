/*
  # Messaging abuse guardrails (phone-first)

  1. New tables
    - public.message_suppression_list
    - public.account_messaging_reputation
    - public.messaging_risk_events

  2. Existing tables extended
    - public.message_automation_events risk telemetry columns
    - public.customers consent columns
*/

CREATE TABLE IF NOT EXISTS public.message_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'sms',
  address text NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  source text NOT NULL DEFAULT 'system',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_suppression_list_channel_check CHECK (channel = ANY (ARRAY['sms', 'email']))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_suppression_unique_active
  ON public.message_suppression_list (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), channel, address, active);

CREATE INDEX IF NOT EXISTS idx_message_suppression_lookup
  ON public.message_suppression_list (channel, address, account_id)
  WHERE active = true;

ALTER TABLE public.message_suppression_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view suppression entries" ON public.message_suppression_list;
CREATE POLICY "Account members can view suppression entries"
  ON public.message_suppression_list
  FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = message_suppression_list.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS public.account_messaging_reputation (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  sms_state text NOT NULL DEFAULT 'active',
  sms_risk_score integer NOT NULL DEFAULT 0,
  blocked_attempts integer NOT NULL DEFAULT 0,
  failed_delivery_count integer NOT NULL DEFAULT 0,
  opt_out_count integer NOT NULL DEFAULT 0,
  unknown_recipient_count integer NOT NULL DEFAULT 0,
  last_state_change_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_messaging_reputation_sms_state_check CHECK (sms_state = ANY (ARRAY['active', 'limited', 'suspended']))
);

ALTER TABLE public.account_messaging_reputation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view messaging reputation" ON public.account_messaging_reputation;
CREATE POLICY "Account members can view messaging reputation"
  ON public.account_messaging_reputation
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = account_messaging_reputation.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS public.messaging_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'sms',
  recipient text NULL,
  template_id text NULL,
  message_excerpt text NULL,
  risk_score integer NOT NULL DEFAULT 0,
  decision text NOT NULL,
  reason text NOT NULL,
  policy_version text NOT NULL DEFAULT 'sms_policy_v1',
  cooldown_until timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messaging_risk_events_channel_check CHECK (channel = ANY (ARRAY['sms', 'email'])),
  CONSTRAINT messaging_risk_events_decision_check CHECK (decision = ANY (ARRAY['allow', 'deny', 'cooldown']))
);

CREATE INDEX IF NOT EXISTS idx_messaging_risk_events_account_created
  ON public.messaging_risk_events (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messaging_risk_events_recipient
  ON public.messaging_risk_events (account_id, recipient, created_at DESC);

ALTER TABLE public.messaging_risk_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view messaging risk events" ON public.messaging_risk_events;
CREATE POLICY "Account members can view messaging risk events"
  ON public.messaging_risk_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = messaging_risk_events.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

ALTER TABLE public.message_automation_events
  ADD COLUMN IF NOT EXISTS risk_score integer,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS policy_version text,
  ADD COLUMN IF NOT EXISTS carrier_error_code text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sms_consent_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS sms_consent_source text,
  ADD COLUMN IF NOT EXISTS sms_consent_captured_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_sms_consent_status_check'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_sms_consent_status_check
      CHECK (sms_consent_status IN ('unknown', 'opted_in', 'opted_out'));
  END IF;
END $$;
