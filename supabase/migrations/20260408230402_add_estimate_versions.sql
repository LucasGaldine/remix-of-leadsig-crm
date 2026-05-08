/*
  # Add Estimate Versions

  1. New table: estimate_versions
    - Stores named snapshots of estimates before approval (Good / Better / Best, etc.)
    - Includes financial fields and full line item snapshot JSON

  2. Security
    - Enable RLS
    - Allow authenticated account members to read/write versions in their account

  3. Backfill
    - Create an initial `Version 1` snapshot for existing estimates that do not yet have versions
*/

CREATE TABLE IF NOT EXISTS public.estimate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  profit_margin numeric NOT NULL DEFAULT 0,
  surcharge numeric NOT NULL DEFAULT 0,
  notes text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_versions_estimate_id
  ON public.estimate_versions(estimate_id);

CREATE INDEX IF NOT EXISTS idx_estimate_versions_account_id
  ON public.estimate_versions(account_id);

ALTER TABLE public.estimate_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can view estimate versions"
  ON public.estimate_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = estimate_versions.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can insert estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can insert estimate versions"
  ON public.estimate_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = estimate_versions.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can update estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can update estimate versions"
  ON public.estimate_versions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = estimate_versions.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = estimate_versions.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "Account members can delete estimate versions" ON public.estimate_versions;
CREATE POLICY "Account members can delete estimate versions"
  ON public.estimate_versions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members am
      WHERE am.account_id = estimate_versions.account_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.set_estimate_versions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_estimate_versions_updated_at ON public.estimate_versions;
CREATE TRIGGER trg_set_estimate_versions_updated_at
  BEFORE UPDATE ON public.estimate_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_estimate_versions_updated_at();

INSERT INTO public.estimate_versions (
  estimate_id,
  account_id,
  name,
  subtotal,
  tax_rate,
  tax,
  discount,
  total,
  profit_margin,
  surcharge,
  notes,
  line_items
)
SELECT
  e.id,
  e.account_id,
  'Version 1',
  COALESCE(e.subtotal, 0),
  COALESCE(e.tax_rate, 0),
  COALESCE(e.tax, 0),
  COALESCE(e.discount, 0),
  COALESCE(e.total, 0),
  COALESCE(e.profit_margin, 0),
  COALESCE(e.surcharge, 0),
  e.notes,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', li.name,
        'description', li.description,
        'quantity', li.quantity,
        'unit', li.unit,
        'unit_price', li.unit_price,
        'total', li.total,
        'sort_order', COALESCE(li.sort_order, 0),
        'category', COALESCE(li.category, 'other')
      )
      ORDER BY COALESCE(li.sort_order, 0), li.created_at, li.id
    ) FILTER (
      WHERE li.id IS NOT NULL
        AND (NOT COALESCE(li.is_change_order, false) OR li.change_order_type <> 'deleted')
    ),
    '[]'::jsonb
  )
FROM public.estimates e
LEFT JOIN public.estimate_line_items li
  ON li.estimate_id = e.id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.estimate_versions ev
  WHERE ev.estimate_id = e.id
)
GROUP BY e.id;;
