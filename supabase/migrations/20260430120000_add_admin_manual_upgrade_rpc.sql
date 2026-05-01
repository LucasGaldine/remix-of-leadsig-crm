create or replace function public.admin_mark_account_upgraded(
  target_account_id uuid,
  target_plan text default 'basic',
  target_tier text default 'solo'
)
returns public.accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  normalized_plan text := lower(coalesce(target_plan, 'basic'));
  normalized_tier text := lower(coalesce(target_tier, 'solo'));
  updated_account public.accounts%rowtype;
begin
  if allowed_email <> 'lucas.galdine@gmail.com' then
    raise exception 'Only the system admin can manually upgrade accounts';
  end if;

  if normalized_plan not in ('basic', 'premium') then
    raise exception 'Manual upgrades only support basic or premium plans';
  end if;

  if normalized_plan = 'basic' and normalized_tier not in ('solo', 'team', 'growth') then
    raise exception 'Invalid basic tier';
  end if;

  if normalized_plan = 'premium' then
    normalized_tier := null;
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.accounts
  set
    pricing_plan = normalized_plan,
    pricing_tier = normalized_tier,
    stripe_subscription_status = 'manual_upgraded'
  where id = target_account_id
  returning * into updated_account;

  if updated_account.id is null then
    raise exception 'Account not found';
  end if;

  return updated_account;
end;
$$;

revoke all on function public.admin_mark_account_upgraded(uuid, text, text) from public;
revoke all on function public.admin_mark_account_upgraded(uuid, text, text) from anon;
grant execute on function public.admin_mark_account_upgraded(uuid, text, text) to authenticated;
