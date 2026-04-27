create or replace function public.enforce_job_application_submission_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_new_email text;
  normalized_new_phone text;
begin
  new.email := lower(trim(new.email));
  new.phone_number := trim(new.phone_number);

  normalized_new_email := lower(trim(new.email));
  normalized_new_phone := regexp_replace(new.phone_number, '\\D', '', 'g');

  if normalized_new_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' then
    raise exception using
      errcode = '23514',
      constraint = 'job_applications_email_format_valid',
      message = 'Please provide a valid email address.';
  end if;

  if exists (
    select 1
    from public.job_applications ja
    where ja.account_id = new.account_id
      and lower(trim(ja.email)) = normalized_new_email
      and (new.id is null or ja.id <> new.id)
  ) then
    raise exception using
      errcode = '23505',
      constraint = 'job_applications_account_email_unique',
      message = 'An application with this email has already been submitted.';
  end if;

  if exists (
    select 1
    from public.job_applications ja
    where ja.account_id = new.account_id
      and (
        case
          when normalized_new_phone <> ''
            then regexp_replace(ja.phone_number, '\\D', '', 'g') = normalized_new_phone
          else lower(trim(ja.phone_number)) = lower(trim(new.phone_number))
        end
      )
      and (new.id is null or ja.id <> new.id)
  ) then
    raise exception using
      errcode = '23505',
      constraint = 'job_applications_account_phone_unique',
      message = 'An application with this phone number has already been submitted.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_job_application_submission_rules on public.job_applications;
create trigger trg_enforce_job_application_submission_rules
before insert or update on public.job_applications
for each row execute function public.enforce_job_application_submission_rules();

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
            and lower(coalesce(role ->> 'status', 'draft')) in ('published', 'active')
        )
    )
  );
