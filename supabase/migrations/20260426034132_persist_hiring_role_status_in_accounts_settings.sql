-- Ensure hiring role JSON always includes a persisted status key.
-- Applies to both settings.website.hiring_roles and settings.hiring_roles.

CREATE OR REPLACE FUNCTION public.normalize_hiring_roles_status(_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  s jsonb := COALESCE(_settings, '{}'::jsonb);
BEGIN
  IF jsonb_typeof(s #> '{website,hiring_roles}') = 'array' THEN
    s := jsonb_set(
      s,
      '{website,hiring_roles}',
      (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN jsonb_typeof(role_item) <> 'object' THEN role_item
              ELSE jsonb_set(
                role_item,
                '{status}',
                to_jsonb(
                  CASE
                    WHEN NULLIF(BTRIM(role_item->>'status'), '') IS NOT NULL THEN
                      CASE LOWER(BTRIM(role_item->>'status'))
                        WHEN 'open' THEN 'published'
                        WHEN 'active' THEN 'published'
                        WHEN 'closed' THEN 'archived'
                        WHEN 'inactive' THEN 'archived'
                        ELSE LOWER(BTRIM(role_item->>'status'))
                      END
                    WHEN LOWER(COALESCE(role_item->>'is_open', 'true')) IN ('false', '0', 'no') THEN 'archived'
                    WHEN LOWER(COALESCE(role_item->>'active', 'true')) IN ('false', '0', 'no') THEN 'archived'
                    WHEN LOWER(COALESCE(role_item->>'is_active', 'true')) IN ('false', '0', 'no') THEN 'archived'
                    ELSE 'published'
                  END
                ),
                true
              )
            END
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(s #> '{website,hiring_roles}') AS role_item
      ),
      true
    );
  END IF;

  IF jsonb_typeof(s->'hiring_roles') = 'array' THEN
    s := jsonb_set(
      s,
      '{hiring_roles}',
      (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN jsonb_typeof(role_item) <> 'object' THEN role_item
              ELSE jsonb_set(
                role_item,
                '{status}',
                to_jsonb(
                  CASE
                    WHEN NULLIF(BTRIM(role_item->>'status'), '') IS NOT NULL THEN
                      CASE LOWER(BTRIM(role_item->>'status'))
                        WHEN 'open' THEN 'published'
                        WHEN 'active' THEN 'published'
                        WHEN 'closed' THEN 'archived'
                        WHEN 'inactive' THEN 'archived'
                        ELSE LOWER(BTRIM(role_item->>'status'))
                      END
                    WHEN LOWER(COALESCE(role_item->>'is_open', 'true')) IN ('false', '0', 'no') THEN 'archived'
                    WHEN LOWER(COALESCE(role_item->>'active', 'true')) IN ('false', '0', 'no') THEN 'archived'
                    WHEN LOWER(COALESCE(role_item->>'is_active', 'true')) IN ('false', '0', 'no') THEN 'archived'
                    ELSE 'published'
                  END
                ),
                true
              )
            END
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(s->'hiring_roles') AS role_item
      ),
      true
    );
  END IF;

  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounts_normalize_hiring_role_status_tg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.settings := public.normalize_hiring_roles_status(NEW.settings);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'accounts'
         AND column_name = 'settings'
     ) THEN
    -- Backfill existing rows.
    EXECUTE $sql$
      UPDATE public.accounts
      SET settings = public.normalize_hiring_roles_status(settings)
      WHERE settings IS NOT NULL
    $sql$;

    -- Keep future writes normalized.
    EXECUTE 'DROP TRIGGER IF EXISTS trg_accounts_normalize_hiring_role_status ON public.accounts';
    EXECUTE $sql$
      CREATE TRIGGER trg_accounts_normalize_hiring_role_status
      BEFORE INSERT OR UPDATE OF settings
      ON public.accounts
      FOR EACH ROW
      EXECUTE FUNCTION public.accounts_normalize_hiring_role_status_tg()
    $sql$;
  END IF;
END $$;;
