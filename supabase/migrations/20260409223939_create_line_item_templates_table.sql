create table if not exists public.line_item_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'each',
  unit_price numeric(12,2) not null default 0,
  category public.line_item_category not null default 'other'::public.line_item_category,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_line_item_templates_account_id on public.line_item_templates(account_id);

alter table public.line_item_templates enable row level security;

drop policy if exists "Users can view line item templates in their account" on public.line_item_templates;
create policy "Users can view line item templates in their account"
  on public.line_item_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.account_members
      where account_members.account_id = line_item_templates.account_id
        and account_members.user_id = auth.uid()
        and account_members.is_active = true
    )
  );

drop policy if exists "Users can insert line item templates in their account" on public.line_item_templates;
create policy "Users can insert line item templates in their account"
  on public.line_item_templates
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.account_members
      where account_members.account_id = line_item_templates.account_id
        and account_members.user_id = auth.uid()
        and account_members.is_active = true
    )
  );

drop policy if exists "Users can update line item templates in their account" on public.line_item_templates;
create policy "Users can update line item templates in their account"
  on public.line_item_templates
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.account_members
      where account_members.account_id = line_item_templates.account_id
        and account_members.user_id = auth.uid()
        and account_members.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.account_members
      where account_members.account_id = line_item_templates.account_id
        and account_members.user_id = auth.uid()
        and account_members.is_active = true
    )
  );

drop policy if exists "Users can delete line item templates in their account" on public.line_item_templates;
create policy "Users can delete line item templates in their account"
  on public.line_item_templates
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.account_members
      where account_members.account_id = line_item_templates.account_id
        and account_members.user_id = auth.uid()
        and account_members.is_active = true
    )
  );

drop trigger if exists update_line_item_templates_updated_at on public.line_item_templates;
create trigger update_line_item_templates_updated_at
before update on public.line_item_templates
for each row
execute function public.update_updated_at_column();;
