-- ELO memberships + LeadSig entitlements
-- Keeps LeadSig auth/accounts separate while enforcing ELO-based access where linked.

CREATE TABLE IF NOT EXISTS public.elo_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email text NOT NULL,
  elo_member_id text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'canceled', 'past_due', 'grace')),
  plan text NOT NULL DEFAULT 'growth',
  source text NOT NULL DEFAULT 'elo_sync',
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  last_checked_at timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_elo_memberships_normalized_email
  ON public.elo_memberships(normalized_email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_elo_memberships_elo_member_id
  ON public.elo_memberships(elo_member_id)
  WHERE elo_member_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_elo_memberships_updated_at ON public.elo_memberships;
CREATE TRIGGER update_elo_memberships_updated_at
BEFORE UPDATE ON public.elo_memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.elo_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages elo memberships" ON public.elo_memberships;
CREATE POLICY "Service role manages elo memberships"
  ON public.elo_memberships
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.account_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.elo_memberships(id) ON DELETE SET NULL,
  entitlement_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'inactive', 'grace')),
  effective_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_entitlements_entitlement_key_check CHECK (entitlement_key IN ('leadsig_growth'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_entitlements_account_key
  ON public.account_entitlements(account_id, entitlement_key);

DROP TRIGGER IF EXISTS update_account_entitlements_updated_at ON public.account_entitlements;
CREATE TRIGGER update_account_entitlements_updated_at
BEFORE UPDATE ON public.account_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view account entitlements" ON public.account_entitlements;
CREATE POLICY "Account members can view account entitlements"
  ON public.account_entitlements
  FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id, auth.uid()));

DROP POLICY IF EXISTS "Service role manages account entitlements" ON public.account_entitlements;
CREATE POLICY "Service role manages account entitlements"
  ON public.account_entitlements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Backfill elo_memberships from existing eligibility table.
ALTER TABLE IF EXISTS public.elo_growth_signups
  ADD COLUMN IF NOT EXISTS expected_plan text NOT NULL DEFAULT 'basic';

ALTER TABLE IF EXISTS public.elo_growth_signups
  ADD COLUMN IF NOT EXISTS expected_tier text NOT NULL DEFAULT 'growth';

ALTER TABLE IF EXISTS public.elo_growth_signups
  ADD COLUMN IF NOT EXISTS normalized_email text;

UPDATE public.elo_growth_signups
SET normalized_email = lower(btrim(email))
WHERE normalized_email IS NULL
  AND email IS NOT NULL;

INSERT INTO public.elo_memberships (
  normalized_email,
  status,
  plan,
  source,
  last_synced_at,
  metadata
)
SELECT
  COALESCE(egs.normalized_email, lower(btrim(egs.email))),
  'active',
  COALESCE(NULLIF(egs.expected_tier, ''), 'growth'),
  'legacy_elo_growth_signups',
  now(),
  jsonb_build_object(
    'legacy_elo_growth_signup_id', egs.id,
    'legacy_expected_plan', egs.expected_plan,
    'legacy_expected_tier', egs.expected_tier
  )
FROM public.elo_growth_signups egs
WHERE COALESCE(egs.normalized_email, lower(btrim(egs.email))) IS NOT NULL
ON CONFLICT (normalized_email) DO NOTHING;

-- Backfill account entitlements by matching account member profile email to ELO memberships.
INSERT INTO public.account_entitlements (
  account_id,
  membership_id,
  entitlement_key,
  status,
  effective_at
)
SELECT DISTINCT
  am.account_id,
  em.id,
  'leadsig_growth',
  CASE
    WHEN em.status IN ('active', 'grace') THEN 'active'
    ELSE 'inactive'
  END,
  now()
FROM public.account_members am
JOIN public.profiles p ON p.user_id = am.user_id
JOIN public.elo_memberships em ON em.normalized_email = lower(btrim(p.email))
WHERE am.is_active = true
ON CONFLICT (account_id, entitlement_key) DO UPDATE
SET
  membership_id = EXCLUDED.membership_id,
  status = EXCLUDED.status,
  updated_at = now();

-- Auto-link entitlements when members are added and profile email is ELO-eligible.
CREATE OR REPLACE FUNCTION public.sync_account_entitlement_from_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_email text;
  v_membership_id uuid;
  v_membership_status text;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  SELECT lower(btrim(email))
  INTO v_email
  FROM public.profiles
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  SELECT id, status
  INTO v_membership_id, v_membership_status
  FROM public.elo_memberships
  WHERE normalized_email = v_email
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.account_entitlements (
    account_id,
    membership_id,
    entitlement_key,
    status,
    effective_at
  ) VALUES (
    NEW.account_id,
    v_membership_id,
    'leadsig_growth',
    CASE WHEN v_membership_status IN ('active', 'grace') THEN 'active' ELSE 'inactive' END,
    now()
  )
  ON CONFLICT (account_id, entitlement_key) DO UPDATE
  SET
    membership_id = EXCLUDED.membership_id,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_account_entitlement_from_member_trigger ON public.account_members;
CREATE TRIGGER sync_account_entitlement_from_member_trigger
AFTER INSERT OR UPDATE OF is_active ON public.account_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_entitlement_from_member();
