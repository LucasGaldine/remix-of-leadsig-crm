ALTER TABLE IF EXISTS public.elo_growth_signups
  ADD COLUMN IF NOT EXISTS normalized_email text;

CREATE OR REPLACE FUNCTION public.set_elo_growth_signup_normalized_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

UPDATE public.elo_growth_signups
SET normalized_email = lower(btrim(email))
WHERE normalized_email IS NULL;

DROP TRIGGER IF EXISTS set_elo_growth_signup_normalized_email ON public.elo_growth_signups;
CREATE TRIGGER set_elo_growth_signup_normalized_email
BEFORE INSERT OR UPDATE ON public.elo_growth_signups
FOR EACH ROW
EXECUTE FUNCTION public.set_elo_growth_signup_normalized_email();

CREATE UNIQUE INDEX IF NOT EXISTS idx_elo_growth_signups_normalized_email
  ON public.elo_growth_signups (normalized_email);;
