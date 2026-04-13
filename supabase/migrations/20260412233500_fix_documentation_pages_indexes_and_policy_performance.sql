create index if not exists idx_documentation_pages_created_by
  on public.documentation_pages(created_by);

drop policy if exists "Lucas can view documentation pages" on public.documentation_pages;
create policy "Lucas can view documentation pages"
  on public.documentation_pages
  for select
  to authenticated
  using (
    (select lower(coalesce(auth.email(), ''))) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
  );

drop policy if exists "Lucas can insert documentation pages" on public.documentation_pages;
create policy "Lucas can insert documentation pages"
  on public.documentation_pages
  for insert
  to authenticated
  with check (
    (select lower(coalesce(auth.email(), ''))) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
    and created_by = (select auth.uid())
  );

drop policy if exists "Lucas can update documentation pages" on public.documentation_pages;
create policy "Lucas can update documentation pages"
  on public.documentation_pages
  for update
  to authenticated
  using (
    (select lower(coalesce(auth.email(), ''))) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
  )
  with check (
    (select lower(coalesce(auth.email(), ''))) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
    and created_by = (select auth.uid())
  );

drop policy if exists "Lucas can delete documentation pages" on public.documentation_pages;
create policy "Lucas can delete documentation pages"
  on public.documentation_pages
  for delete
  to authenticated
  using (
    (select lower(coalesce(auth.email(), ''))) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
  );
