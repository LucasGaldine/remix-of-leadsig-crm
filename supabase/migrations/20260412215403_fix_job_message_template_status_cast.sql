CREATE OR REPLACE FUNCTION public.render_job_message_template(
  template_text text,
  lead_name text,
  service_type text,
  lead_status public.unified_status,
  lead_id uuid,
  scheduled_date_text text,
  scheduled_time_text text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.render_job_message_template(
    template_text,
    lead_name,
    service_type,
    lead_status::text,
    lead_id,
    scheduled_date_text,
    scheduled_time_text
  );
$$;;
