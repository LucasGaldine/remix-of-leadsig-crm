drop policy if exists "Lucas can view documentation pages" on public.documentation_pages;
drop policy if exists "Documentation pages are publicly readable" on public.documentation_pages;

create policy "Documentation pages are publicly readable"
  on public.documentation_pages
  for select
  to anon, authenticated
  using (true);
