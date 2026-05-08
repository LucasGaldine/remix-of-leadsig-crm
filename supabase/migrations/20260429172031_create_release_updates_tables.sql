create table if not exists public.release_updates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  highlights jsonb not null default '[]'::jsonb,
  version text not null,
  released_at date not null,
  cta_label text,
  cta_href text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_updates_title_not_empty check (length(trim(title)) > 0),
  constraint release_updates_description_not_empty check (length(trim(description)) > 0),
  constraint release_updates_version_not_empty check (length(trim(version)) > 0),
  constraint release_updates_highlights_is_array check (jsonb_typeof(highlights) = 'array')
);

create index if not exists idx_release_updates_account_id
  on public.release_updates(account_id);

create index if not exists idx_release_updates_account_published_release_date
  on public.release_updates(account_id, is_published, released_at desc, created_at desc);

alter table public.release_updates enable row level security;

drop policy if exists "Account members can view release updates" on public.release_updates;
create policy "Account members can view release updates"
  on public.release_updates
  for select
  to authenticated
  using (public.is_account_member(account_id, (select auth.uid())));

drop policy if exists "Account admins can insert release updates" on public.release_updates;
create policy "Account admins can insert release updates"
  on public.release_updates
  for insert
  to authenticated
  with check (
    public.is_account_admin(account_id, (select auth.uid()))
    and created_by = (select auth.uid())
  );

drop policy if exists "Account admins can update release updates" on public.release_updates;
create policy "Account admins can update release updates"
  on public.release_updates
  for update
  to authenticated
  using (public.is_account_admin(account_id, (select auth.uid())))
  with check (public.is_account_admin(account_id, (select auth.uid())));

drop policy if exists "Account admins can delete release updates" on public.release_updates;
create policy "Account admins can delete release updates"
  on public.release_updates
  for delete
  to authenticated
  using (public.is_account_admin(account_id, (select auth.uid())));

drop trigger if exists update_release_updates_updated_at on public.release_updates;
create trigger update_release_updates_updated_at
before update on public.release_updates
for each row
execute function public.update_updated_at_column();

create table if not exists public.release_update_reads (
  id uuid primary key default gen_random_uuid(),
  release_update_id uuid not null references public.release_updates(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_update_reads_unique unique (release_update_id, user_id)
);

create index if not exists idx_release_update_reads_user_id
  on public.release_update_reads(user_id);

create index if not exists idx_release_update_reads_release_update_id
  on public.release_update_reads(release_update_id);

alter table public.release_update_reads enable row level security;

drop policy if exists "Users can view own release update reads" on public.release_update_reads;
create policy "Users can view own release update reads"
  on public.release_update_reads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_account_member(account_id, (select auth.uid()))
  );

drop policy if exists "Users can insert own release update reads" on public.release_update_reads;
create policy "Users can insert own release update reads"
  on public.release_update_reads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_account_member(account_id, (select auth.uid()))
  );

drop policy if exists "Users can update own release update reads" on public.release_update_reads;
create policy "Users can update own release update reads"
  on public.release_update_reads
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_account_member(account_id, (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and public.is_account_member(account_id, (select auth.uid()))
  );

drop trigger if exists update_release_update_reads_updated_at on public.release_update_reads;
create trigger update_release_update_reads_updated_at
before update on public.release_update_reads
for each row
execute function public.update_updated_at_column();;
