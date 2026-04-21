CREATE OR REPLACE FUNCTION public.get_public_site(account_uuid uuid)
RETURNS TABLE (
  company_name text,
  company_phone text,
  company_email text,
  company_address text,
  logo_url text,
  settings jsonb,
  published boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.company_name,
    a.company_phone,
    a.company_email,
    a.company_address,
    a.logo_url,
    COALESCE(a.settings, '{}'::jsonb) AS settings,
    COALESCE((a.settings -> 'website' ->> 'published')::boolean, false) AS published
  FROM public.accounts a
  WHERE a.id = account_uuid
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_site(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_site(uuid) TO authenticated;
