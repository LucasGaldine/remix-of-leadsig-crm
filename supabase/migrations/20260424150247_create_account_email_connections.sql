create table if not exists public.account_email_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null default 'google',
  connected_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  connected_by_user_id uuid references auth.users(id) on delete set null,
  oauth_nonce text,
  oauth_nonce_created_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_email_connections_provider_check check (provider in ('google')),
  constraint account_email_connections_account_provider_unique unique (account_id, provider)
);

create index if not exists idx_account_email_connections_account_id
  on public.account_email_connections(account_id);

alter table public.account_email_connections enable row level security;

comment on table public.account_email_connections is
  'Account-scoped sender mailbox OAuth tokens. Managed through service-role edge functions only.';;
