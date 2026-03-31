alter table public.job_schedules
  add column if not exists suppress_unassigned boolean not null default false;

comment on column public.job_schedules.suppress_unassigned is
  'When true, this schedule should not contribute to unassigned job state even if no crew member is assigned.';
