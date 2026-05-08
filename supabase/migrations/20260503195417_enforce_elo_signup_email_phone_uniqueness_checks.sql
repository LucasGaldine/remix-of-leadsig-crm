begin;

-- Normalized phone uniqueness for elo signup records.
create unique index if not exists uq_elo_growth_signups_phone_digits
  on public.elo_growth_signups ((regexp_replace(phone, '[^0-9]+', '', 'g')))
  where phone is not null and length(regexp_replace(phone, '[^0-9]+', '', 'g')) > 0;

-- Central eligibility check for backend signup endpoint.
create or replace function public.can_register_elo_growth_signup(
  p_email text,
  p_phone text default null
)
returns table (
  can_register boolean,
  email_exists boolean,
  phone_exists boolean,
  reason text
)
language plpgsql
stable
as $$
declare
  v_email text;
  v_phone_digits text;
  v_email_exists boolean;
  v_phone_exists boolean;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]+', '', 'g');

  if v_email = '' then
    return query select false, false, false, 'email_required'::text;
    return;
  end if;

  select exists (
    select 1
    from public.elo_growth_signups e
    where lower(e.email) = v_email
  ) or exists (
    select 1
    from public.profiles p
    where lower(coalesce(p.email, '')) = v_email
  )
  into v_email_exists;

  select
    case
      when v_phone_digits = '' then false
      else exists (
        select 1
        from public.elo_growth_signups e
        where regexp_replace(coalesce(e.phone, ''), '[^0-9]+', '', 'g') = v_phone_digits
      ) or exists (
        select 1
        from public.profiles p
        where regexp_replace(coalesce(p.phone, ''), '[^0-9]+', '', 'g') = v_phone_digits
      )
    end
  into v_phone_exists;

  if v_email_exists then
    return query select false, true, v_phone_exists, 'email_exists'::text;
  elsif v_phone_exists then
    return query select false, v_email_exists, true, 'phone_exists'::text;
  else
    return query select true, false, false, 'ok'::text;
  end if;
end;
$$;

alter function public.can_register_elo_growth_signup(text, text) set search_path = public, pg_temp;
grant execute on function public.can_register_elo_growth_signup(text, text) to anon, authenticated, service_role;

commit;;
