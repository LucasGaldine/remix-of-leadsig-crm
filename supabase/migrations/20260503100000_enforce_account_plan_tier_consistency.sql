-- Enforce pricing plan/tier consistency at the DB layer
-- - basic requires one of (solo, team, growth)
-- - free/premium must have NULL tier

update public.accounts
set pricing_tier = null
where pricing_plan in ('free', 'premium')
  and pricing_tier is not null;

alter table public.accounts
  drop constraint if exists accounts_pricing_tier_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_pricing_plan_tier_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_pricing_plan_tier_check
      check (
        (pricing_plan = 'basic' and pricing_tier in ('solo', 'team', 'growth'))
        or (pricing_plan in ('free', 'premium') and pricing_tier is null)
      );
  end if;
end
$$;
