create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  role_id text not null,
  role_title text not null,
  full_name text not null,
  phone_number text not null,
  email text not null,
  city text not null,
  reliable_transportation boolean not null,
  landscaping_or_labor_experience text not null,
  available_full_time boolean not null,
  expected_hourly_pay text not null,
  why_hire_you text not null,
  created_at timestamptz not null default now(),
  constraint job_applications_role_id_not_empty check (length(trim(role_id)) > 0),
  constraint job_applications_role_title_not_empty check (length(trim(role_title)) > 0),
  constraint job_applications_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint job_applications_phone_number_not_empty check (length(trim(phone_number)) > 0),
  constraint job_applications_email_not_empty check (length(trim(email)) > 0),
  constraint job_applications_city_not_empty check (length(trim(city)) > 0),
  constraint job_applications_experience_valid check (landscaping_or_labor_experience in ('0', '1–2', '3+')),
  constraint job_applications_expected_hourly_pay_not_empty check (length(trim(expected_hourly_pay)) > 0),
  constraint job_applications_why_hire_you_not_empty check (length(trim(why_hire_you)) > 0)
);

create index if not exists idx_job_applications_account_id
  on public.job_applications(account_id);

create index if not exists idx_job_applications_account_created_at
  on public.job_applications(account_id, created_at desc);

create index if not exists idx_job_applications_account_role_created_at
  on public.job_applications(account_id, role_id, created_at desc);

alter table public.job_applications enable row level security;

drop policy if exists "Account members can view job applications" on public.job_applications;
create policy "Account members can view job applications"
  on public.job_applications
  for select
  to authenticated
  using (public.is_account_member(account_id, (select auth.uid())));

drop policy if exists "Public can submit job applications to published sites" on public.job_applications;
create policy "Public can submit job applications to published sites"
  on public.job_applications
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = job_applications.account_id
        and coalesce((a.settings -> 'website' ->> 'published')::boolean, false) = true
        and exists (
          select 1
          from jsonb_array_elements(coalesce(a.settings -> 'website' -> 'hiring_roles', '[]'::jsonb)) as role
          where role ->> 'id' = job_applications.role_id
        )
    )
  );
