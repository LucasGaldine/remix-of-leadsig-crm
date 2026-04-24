create index if not exists idx_account_email_connections_connected_by_user_id
  on public.account_email_connections(connected_by_user_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_email_connections'
      and policyname = 'Service role can select account email connections'
  ) then
    create policy "Service role can select account email connections"
      on public.account_email_connections for select
      to service_role
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_email_connections'
      and policyname = 'Service role can insert account email connections'
  ) then
    create policy "Service role can insert account email connections"
      on public.account_email_connections for insert
      to service_role
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_email_connections'
      and policyname = 'Service role can update account email connections'
  ) then
    create policy "Service role can update account email connections"
      on public.account_email_connections for update
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_email_connections'
      and policyname = 'Service role can delete account email connections'
  ) then
    create policy "Service role can delete account email connections"
      on public.account_email_connections for delete
      to service_role
      using (true);
  end if;
end $$;
