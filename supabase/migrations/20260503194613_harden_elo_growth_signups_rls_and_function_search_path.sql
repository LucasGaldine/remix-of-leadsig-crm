begin;

alter table public.elo_growth_signups enable row level security;

-- Deny direct reads/writes from anon/authenticated roles by default.
drop policy if exists elo_growth_signups_no_access_select on public.elo_growth_signups;
create policy elo_growth_signups_no_access_select
  on public.elo_growth_signups
  for select
  to anon, authenticated
  using (false);

drop policy if exists elo_growth_signups_no_access_insert on public.elo_growth_signups;
create policy elo_growth_signups_no_access_insert
  on public.elo_growth_signups
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists elo_growth_signups_no_access_update on public.elo_growth_signups;
create policy elo_growth_signups_no_access_update
  on public.elo_growth_signups
  for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists elo_growth_signups_no_access_delete on public.elo_growth_signups;
create policy elo_growth_signups_no_access_delete
  on public.elo_growth_signups
  for delete
  to anon, authenticated
  using (false);

alter function public.touch_elo_growth_signups_updated_at() set search_path = public, pg_temp;
alter function public.get_elo_membership_status(text, text) set search_path = public, pg_temp;

commit;;
