begin;

alter table public.accounts
  add column if not exists onboarding_required boolean not null default false,
  add column if not exists onboarding_completed_at timestamp with time zone,
  add column if not exists signup_source text;

-- enforce dedupe at DB layer for Stripe identity
create unique index if not exists uq_accounts_stripe_customer_id
  on public.accounts (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.elo_growth_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  elo_user_id text not null,
  full_name text,
  phone text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  pricing_tier text,
  onboarding_required boolean not null default true,
  onboarding_completed_at timestamp with time zone,
  signup_source text not null default 'elo',
  account_id uuid references public.accounts(id) on delete set null,
  membership_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists uq_elo_growth_signups_elo_user_id
  on public.elo_growth_signups (elo_user_id);

create unique index if not exists uq_elo_growth_signups_email_ci
  on public.elo_growth_signups (lower(email));

create unique index if not exists uq_elo_growth_signups_stripe_customer_id
  on public.elo_growth_signups (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists uq_elo_growth_signups_stripe_subscription_id
  on public.elo_growth_signups (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_elo_growth_signups_account_id
  on public.elo_growth_signups (account_id);

create index if not exists idx_elo_growth_signups_membership_active
  on public.elo_growth_signups (membership_active);

create or replace function public.touch_elo_growth_signups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_elo_growth_signups_updated_at on public.elo_growth_signups;
create trigger trg_touch_elo_growth_signups_updated_at
before update on public.elo_growth_signups
for each row execute function public.touch_elo_growth_signups_updated_at();

-- RPC helper for membership status endpoint implementation.
create or replace function public.get_elo_membership_status(
  p_elo_user_id text default null,
  p_email text default null
)
returns table (
  integration_user_ref uuid,
  elo_user_id text,
  email text,
  membership_active boolean,
  onboarding_required boolean,
  onboarding_completed_at timestamp with time zone,
  stripe_subscription_status text,
  pricing_tier text,
  account_id uuid
)
language sql
stable
as $$
  with match_row as (
    select s.*
    from public.elo_growth_signups s
    where (p_elo_user_id is not null and s.elo_user_id = p_elo_user_id)
       or (p_email is not null and lower(s.email) = lower(p_email))
    order by s.updated_at desc
    limit 1
  )
  select
    m.id as integration_user_ref,
    m.elo_user_id,
    m.email,
    (
      coalesce(a.stripe_subscription_status, m.stripe_subscription_status) in ('active', 'trialing')
      and coalesce(a.pricing_tier, m.pricing_tier) = 'growth'
    ) as membership_active,
    coalesce(a.onboarding_required, m.onboarding_required) as onboarding_required,
    coalesce(a.onboarding_completed_at, m.onboarding_completed_at) as onboarding_completed_at,
    coalesce(a.stripe_subscription_status, m.stripe_subscription_status) as stripe_subscription_status,
    coalesce(a.pricing_tier, m.pricing_tier) as pricing_tier,
    coalesce(a.id, m.account_id) as account_id
  from match_row m
  left join public.accounts a on a.id = m.account_id;
$$;

grant execute on function public.get_elo_membership_status(text, text) to anon, authenticated, service_role;

commit;;
