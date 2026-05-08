CREATE TABLE IF NOT EXISTS public.elo_growth_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  normalized_email text,
  source text NOT NULL DEFAULT 'elo',
  expected_plan text NOT NULL DEFAULT 'basic',
  expected_tier text NOT NULL DEFAULT 'growth',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  payment_verified boolean NOT NULL DEFAULT false,
  payment_verified_at timestamptz,
  last_checked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT elo_growth_signups_expected_plan_check CHECK (expected_plan IN ('free', 'basic', 'premium')),
  CONSTRAINT elo_growth_signups_expected_tier_check CHECK (expected_tier IN ('solo', 'team', 'growth'))
);

ALTER TABLE public.elo_growth_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages elo growth signups" ON public.elo_growth_signups;
CREATE POLICY "Service role manages elo growth signups"
  ON public.elo_growth_signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_elo_growth_signups_updated_at ON public.elo_growth_signups;
CREATE TRIGGER update_elo_growth_signups_updated_at
BEFORE UPDATE ON public.elo_growth_signups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();;
