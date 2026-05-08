create table if not exists public.documentation_pages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  summary text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documentation_pages_title_not_empty check (length(trim(title)) > 0),
  constraint documentation_pages_slug_not_empty check (length(trim(slug)) > 0),
  constraint documentation_pages_content_not_empty check (length(trim(content)) > 0),
  constraint documentation_pages_account_slug_unique unique (account_id, slug)
);

create index if not exists idx_documentation_pages_account_id
  on public.documentation_pages(account_id);

create index if not exists idx_documentation_pages_account_created_at
  on public.documentation_pages(account_id, created_at desc);

alter table public.documentation_pages enable row level security;

drop policy if exists "Lucas can view documentation pages" on public.documentation_pages;
create policy "Lucas can view documentation pages"
  on public.documentation_pages
  for select
  to authenticated
  using (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
  );

drop policy if exists "Lucas can insert documentation pages" on public.documentation_pages;
create policy "Lucas can insert documentation pages"
  on public.documentation_pages
  for insert
  to authenticated
  with check (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
    and created_by = (select auth.uid())
  );

drop policy if exists "Lucas can update documentation pages" on public.documentation_pages;
create policy "Lucas can update documentation pages"
  on public.documentation_pages
  for update
  to authenticated
  using (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
  )
  with check (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
    and created_by = (select auth.uid())
  );

drop policy if exists "Lucas can delete documentation pages" on public.documentation_pages;
create policy "Lucas can delete documentation pages"
  on public.documentation_pages
  for delete
  to authenticated
  using (
    lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'lucas.galdine@gmail.com'
    and public.is_account_member(account_id, (select auth.uid()))
  );

drop trigger if exists update_documentation_pages_updated_at on public.documentation_pages;
create trigger update_documentation_pages_updated_at
before update on public.documentation_pages
for each row
execute function public.update_updated_at_column();;
