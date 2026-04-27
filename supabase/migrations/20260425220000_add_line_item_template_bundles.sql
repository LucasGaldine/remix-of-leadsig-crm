alter table public.line_item_templates
  add column if not exists template_type text not null default 'template';

alter table public.line_item_templates
  add column if not exists bundle_items jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'line_item_templates_template_type_check'
  ) then
    alter table public.line_item_templates
      add constraint line_item_templates_template_type_check
      check (template_type in ('template', 'bundle'));
  end if;
end $$;

update public.line_item_templates
set template_type = 'template'
where template_type is null;
