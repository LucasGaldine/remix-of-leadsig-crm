create or replace function public.list_all_accounts_for_admin()
returns table (
  id uuid,
  company_name text,
  company_email text,
  company_phone text,
  created_at timestamptz,
  pricing_plan text,
  pricing_tier text,
  is_active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.company_name,
    a.company_email,
    a.company_phone,
    a.created_at,
    a.pricing_plan,
    a.pricing_tier,
    coalesce(am.is_active, false) as is_active
  from public.accounts a
  left join lateral (
    select m.is_active
    from public.account_members m
    where m.account_id = a.id
    order by m.created_at asc
    limit 1
  ) am on true
  where lower(coalesce((auth.jwt() ->> 'email'), '')) = 'lucas.galdine@gmail.com'
  order by a.created_at desc
  limit 500;
$$;

revoke all on function public.list_all_accounts_for_admin() from public;
revoke all on function public.list_all_accounts_for_admin() from anon;
grant execute on function public.list_all_accounts_for_admin() to authenticated;;
