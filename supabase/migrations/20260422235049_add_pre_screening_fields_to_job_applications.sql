alter table public.job_applications
  add column if not exists screening_tag text not null default 'Qualified',
  add column if not exists screening_stage text not null default 'Pre-Screen Qualified',
  add column if not exists screening_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_applications_screening_tag_valid'
  ) then
    alter table public.job_applications
      add constraint job_applications_screening_tag_valid
      check (screening_tag in ('Reject', 'Review', 'Qualified'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_applications_screening_stage_valid'
  ) then
    alter table public.job_applications
      add constraint job_applications_screening_stage_valid
      check (screening_stage in ('Pre-Screen Rejected', 'Pre-Screen Review', 'Pre-Screen Qualified'));
  end if;
end $$;

create index if not exists idx_job_applications_account_screening_stage
  on public.job_applications(account_id, screening_stage, created_at desc);;
