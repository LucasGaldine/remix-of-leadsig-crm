-- Unify client portal brand colors into canonical account settings keys.
-- Canonical keys:
-- - settings.client_portal_color
-- - settings.client_portal_text_color
-- - settings.client_portal_highlight_color
--
-- Legacy keys normalized here:
-- - settings.portal_color / settings.portal_text_color
-- - settings.brand_color / settings.brand_text_color
-- - settings.website.client_portal_color / client_portal_text_color / client_portal_highlight_color
-- - settings.website.portal_color / portal_text_color
-- - settings.website.brand_color / brand_text_color

update public.accounts
set
  settings = jsonb_strip_nulls(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(settings, '{}'::jsonb),
          '{client_portal_color}',
          to_jsonb(
            coalesce(
              nullif(settings->>'client_portal_color', ''),
              nullif(settings->>'portal_color', ''),
              nullif(settings->>'brand_color', ''),
              nullif(settings#>>'{website,client_portal_color}', ''),
              nullif(settings#>>'{website,portal_color}', ''),
              nullif(settings#>>'{website,brand_color}', '')
            )
          ),
          true
        ),
        '{client_portal_text_color}',
        to_jsonb(
          coalesce(
            nullif(settings->>'client_portal_text_color', ''),
            nullif(settings->>'portal_text_color', ''),
            nullif(settings->>'brand_text_color', ''),
            nullif(settings#>>'{website,client_portal_text_color}', ''),
            nullif(settings#>>'{website,portal_text_color}', ''),
            nullif(settings#>>'{website,brand_text_color}', '')
          )
        ),
        true
      ),
      '{client_portal_highlight_color}',
      to_jsonb(
        coalesce(
          nullif(settings->>'client_portal_highlight_color', ''),
          nullif(settings#>>'{website,client_portal_highlight_color}', '')
        )
      ),
      true
    )
    - 'portal_color'
    - 'portal_text_color'
    - 'brand_color'
    - 'brand_text_color'
  ),
  updated_at = now()
where settings is not null;

update public.accounts
set
  settings = jsonb_set(
    settings,
    '{website}',
    coalesce(settings->'website', '{}'::jsonb)
      - 'client_portal_color'
      - 'portal_color'
      - 'brand_color'
      - 'client_portal_text_color'
      - 'portal_text_color'
      - 'brand_text_color'
      - 'client_portal_highlight_color',
    true
  ),
  updated_at = now()
where settings ? 'website';
