-- Support multiple message templates for job message automation with template-level
-- service-type filters and trigger timing.
-- Keeps backward compatibility with legacy single `message_template` + global rules.

CREATE OR REPLACE FUNCTION public.render_job_message_template(
  template_text text,
  lead_name text,
  service_type text,
  lead_status text,
  lead_id uuid,
  scheduled_date_text text,
  scheduled_time_text text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(COALESCE(template_text, ''), '{{job_name}}', COALESCE(lead_name, '')),
                    '{{client_name}}',
                    COALESCE(lead_name, '')
                  ),
                  '{{first_name}}',
                  NULLIF(split_part(COALESCE(lead_name, ''), ' ', 1), '')
                ),
                '{{service_type}}',
                COALESCE(service_type, '')
              ),
              '{{job_status}}',
              COALESCE(lead_status, '')
            ),
            '{{lead_id}}',
            COALESCE(lead_id::text, '')
          ),
          '{{scheduled_date}}',
          COALESCE(scheduled_date_text, '')
        ),
        '{{scheduled_time}}',
        COALESCE(scheduled_time_text, '')
      ),
      '{{scheduled_datetime}}',
      trim(concat_ws(' ', COALESCE(scheduled_date_text, ''), COALESCE(scheduled_time_text, '')))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.enqueue_job_message_automation_event(
  p_account_id uuid,
  p_lead_id uuid,
  p_trigger_source text,
  p_job_schedule_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config jsonb;
  global_service_types text[];
  global_trigger_type text;
  global_offset_value integer;
  global_offset_unit text;
  global_offset_minutes integer;
  max_attempts integer;
  backoff_minutes integer;
  endpoint_url text;
  auth_header_name text;
  auth_header_value text;

  template_entry jsonb;
  template_content text;
  template_service_types text[];
  template_trigger_type text;
  template_offset_value integer;
  template_offset_unit text;
  template_offset_minutes integer;

  legacy_message_template text;

  schedule_row public.job_schedules%ROWTYPE;
  lead_row public.leads%ROWTYPE;
  base_schedule_ts timestamptz;
  scheduled_for_ts timestamptz;
  rendered_message text;
  payload jsonb;
  templates_processed integer := 0;
BEGIN
  SELECT a.settings -> 'job_message_automation'
  INTO config
  FROM public.accounts a
  WHERE a.id = p_account_id;

  IF config IS NULL OR COALESCE((config ->> 'enabled')::boolean, false) = false THEN
    RETURN;
  END IF;

  SELECT *
  INTO lead_row
  FROM public.leads
  WHERE id = p_lead_id
    AND account_id = p_account_id;

  IF lead_row.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO global_service_types
  FROM jsonb_array_elements_text(COALESCE(config -> 'job_service_types', '[]'::jsonb)) value;

  global_trigger_type := COALESCE(config #>> '{trigger,type}', 'immediate');
  global_offset_unit := COALESCE(
    NULLIF(trim(COALESCE(config #>> '{trigger,offset_unit}', '')), ''),
    CASE
      WHEN config #>> '{trigger,offset_minutes}' IS NOT NULL THEN 'minutes'
      ELSE 'days'
    END
  );
  global_offset_value := GREATEST(
    COALESCE(
      (config #>> '{trigger,offset_value}')::integer,
      CASE
        WHEN config #>> '{trigger,offset_minutes}' IS NOT NULL THEN (config #>> '{trigger,offset_minutes}')::integer
        ELSE 0
      END
    ),
    0
  );
  global_offset_minutes := CASE
    WHEN global_offset_unit = 'seconds' THEN FLOOR(global_offset_value / 60.0)::integer
    WHEN global_offset_unit = 'hours' THEN global_offset_value * 60
    WHEN global_offset_unit = 'days' THEN global_offset_value * 24 * 60
    WHEN global_offset_unit = 'months' THEN global_offset_value * 30 * 24 * 60
    ELSE global_offset_value
  END;
  max_attempts := GREATEST(COALESCE((config #>> '{retry,max_attempts}')::integer, 3), 1);
  backoff_minutes := GREATEST(COALESCE((config #>> '{retry,backoff_minutes}')::integer, 5), 0);

  endpoint_url := NULLIF(trim(COALESCE(config #>> '{endpoint,url}', '')), '');
  auth_header_name := NULLIF(trim(COALESCE(config #>> '{endpoint,auth_header_name}', '')), '');
  auth_header_value := config #>> '{endpoint,auth_header_value}';

  IF endpoint_url IS NULL THEN
    RETURN;
  END IF;

  IF p_job_schedule_id IS NOT NULL THEN
    SELECT *
    INTO schedule_row
    FROM public.job_schedules
    WHERE id = p_job_schedule_id;
  END IF;

  IF schedule_row.id IS NULL THEN
    SELECT *
    INTO schedule_row
    FROM public.job_schedules
    WHERE lead_id = p_lead_id
    ORDER BY scheduled_date ASC, scheduled_time_start ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF schedule_row.id IS NOT NULL THEN
    base_schedule_ts := make_timestamptz(
      EXTRACT(YEAR FROM schedule_row.scheduled_date)::int,
      EXTRACT(MONTH FROM schedule_row.scheduled_date)::int,
      EXTRACT(DAY FROM schedule_row.scheduled_date)::int,
      COALESCE(EXTRACT(HOUR FROM schedule_row.scheduled_time_start)::int, 9),
      COALESCE(EXTRACT(MINUTE FROM schedule_row.scheduled_time_start)::int, 0),
      0,
      'UTC'
    );
  ELSIF lead_row.scheduled_date IS NOT NULL THEN
    base_schedule_ts := make_timestamptz(
      EXTRACT(YEAR FROM lead_row.scheduled_date)::int,
      EXTRACT(MONTH FROM lead_row.scheduled_date)::int,
      EXTRACT(DAY FROM lead_row.scheduled_date)::int,
      COALESCE(EXTRACT(HOUR FROM lead_row.scheduled_time_start)::int, 9),
      COALESCE(EXTRACT(MINUTE FROM lead_row.scheduled_time_start)::int, 0),
      0,
      'UTC'
    );
  ELSE
    base_schedule_ts := now();
  END IF;

  FOR template_entry IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(config -> 'message_templates', '[]'::jsonb))
  LOOP
    IF COALESCE((template_entry ->> 'is_finished')::boolean, true) = false THEN
      CONTINUE;
    END IF;

    template_content := NULLIF(trim(COALESCE(template_entry ->> 'content', '')), '');
    IF template_content IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(value), ARRAY[]::text[])
    INTO template_service_types
    FROM jsonb_array_elements_text(COALESCE(template_entry -> 'job_service_types', to_jsonb(global_service_types))) value;

    IF array_length(template_service_types, 1) IS NOT NULL
       AND COALESCE(lead_row.service_type, '') <> ''
       AND NOT (lead_row.service_type = ANY(template_service_types)) THEN
      CONTINUE;
    END IF;

    template_trigger_type := COALESCE(template_entry #>> '{trigger,type}', global_trigger_type);
    template_offset_unit := COALESCE(
      NULLIF(trim(COALESCE(template_entry #>> '{trigger,offset_unit}', '')), ''),
      CASE
        WHEN template_entry #>> '{trigger,offset_minutes}' IS NOT NULL THEN 'minutes'
        ELSE global_offset_unit
      END
    );
    template_offset_value := GREATEST(
      COALESCE(
        (template_entry #>> '{trigger,offset_value}')::integer,
        CASE
          WHEN template_entry #>> '{trigger,offset_minutes}' IS NOT NULL THEN (template_entry #>> '{trigger,offset_minutes}')::integer
          ELSE global_offset_value
        END
      ),
      0
    );
    template_offset_minutes := CASE
      WHEN template_offset_unit = 'seconds' THEN FLOOR(template_offset_value / 60.0)::integer
      WHEN template_offset_unit = 'hours' THEN template_offset_value * 60
      WHEN template_offset_unit = 'days' THEN template_offset_value * 24 * 60
      WHEN template_offset_unit = 'months' THEN template_offset_value * 30 * 24 * 60
      ELSE template_offset_value
    END;

    IF template_trigger_type = 'after_job_completion' THEN
      IF COALESCE(lead_row.status, '') <> 'completed' THEN
        CONTINUE;
      END IF;
      scheduled_for_ts := now() + make_interval(mins => GREATEST(template_offset_minutes, 0));
    ELSE
      scheduled_for_ts := public.compute_job_message_scheduled_for(
        template_trigger_type,
        template_offset_minutes,
        base_schedule_ts
      );
    END IF;

    rendered_message := public.render_job_message_template(
      template_content,
      lead_row.name,
      lead_row.service_type,
      lead_row.status,
      lead_row.id,
      COALESCE(schedule_row.scheduled_date::text, lead_row.scheduled_date::text, ''),
      COALESCE(schedule_row.scheduled_time_start::text, lead_row.scheduled_time_start::text, '')
    );

    IF rendered_message = '' THEN
      rendered_message := format('Job update for %s', COALESCE(lead_row.name, 'unnamed job'));
    END IF;

    payload := jsonb_build_object(
      'event_type', 'job_message_automation',
      'message', rendered_message,
      'account_id', p_account_id,
      'lead', jsonb_build_object(
        'id', lead_row.id,
        'name', lead_row.name,
        'service_type', lead_row.service_type,
        'status', lead_row.status,
        'scheduled_date', lead_row.scheduled_date,
        'scheduled_time_start', lead_row.scheduled_time_start,
        'scheduled_time_end', lead_row.scheduled_time_end
      ),
      'schedule', CASE
        WHEN schedule_row.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', schedule_row.id,
          'scheduled_date', schedule_row.scheduled_date,
          'scheduled_time_start', schedule_row.scheduled_time_start,
          'scheduled_time_end', schedule_row.scheduled_time_end
        )
      END,
      'template', jsonb_build_object(
        'name', NULLIF(trim(COALESCE(template_entry ->> 'name', '')), ''),
        'service_types', template_service_types
      ),
      'trigger', jsonb_build_object(
        'source', p_trigger_source,
        'type', template_trigger_type,
        'offset_minutes', template_offset_minutes,
        'offset_value', template_offset_value,
        'offset_unit', template_offset_unit,
        'scheduled_for', scheduled_for_ts
      ),
      'generated_at', now()
    );

    INSERT INTO public.message_automation_events (
      account_id,
      lead_id,
      job_schedule_id,
      trigger_source,
      scheduled_for,
      max_attempts,
      backoff_minutes,
      endpoint_url,
      auth_header_name,
      auth_header_value,
      message_template,
      message_rendered,
      payload
    )
    VALUES (
      p_account_id,
      p_lead_id,
      schedule_row.id,
      p_trigger_source,
      scheduled_for_ts,
      max_attempts,
      backoff_minutes,
      endpoint_url,
      auth_header_name,
      auth_header_value,
      template_content,
      rendered_message,
      payload
    );

    templates_processed := templates_processed + 1;
  END LOOP;

  IF templates_processed > 0 THEN
    RETURN;
  END IF;

  legacy_message_template := NULLIF(trim(COALESCE(config ->> 'message_template', '')), '');
  IF legacy_message_template IS NULL THEN
    RETURN;
  END IF;

  IF array_length(global_service_types, 1) IS NOT NULL
     AND COALESCE(lead_row.service_type, '') <> ''
     AND NOT (lead_row.service_type = ANY(global_service_types)) THEN
    RETURN;
  END IF;

  IF global_trigger_type = 'after_job_completion' THEN
    IF COALESCE(lead_row.status, '') <> 'completed' THEN
      RETURN;
    END IF;
    scheduled_for_ts := now() + make_interval(mins => GREATEST(global_offset_minutes, 0));
  ELSE
    scheduled_for_ts := public.compute_job_message_scheduled_for(
      global_trigger_type,
      global_offset_minutes,
      base_schedule_ts
    );
  END IF;
  rendered_message := public.render_job_message_template(
    legacy_message_template,
    lead_row.name,
    lead_row.service_type,
    lead_row.status,
    lead_row.id,
    COALESCE(schedule_row.scheduled_date::text, lead_row.scheduled_date::text, ''),
    COALESCE(schedule_row.scheduled_time_start::text, lead_row.scheduled_time_start::text, '')
  );

  IF rendered_message = '' THEN
    rendered_message := format('Job update for %s', COALESCE(lead_row.name, 'unnamed job'));
  END IF;

  payload := jsonb_build_object(
    'event_type', 'job_message_automation',
    'message', rendered_message,
    'account_id', p_account_id,
    'lead', jsonb_build_object(
      'id', lead_row.id,
      'name', lead_row.name,
      'service_type', lead_row.service_type,
      'status', lead_row.status,
      'scheduled_date', lead_row.scheduled_date,
      'scheduled_time_start', lead_row.scheduled_time_start,
      'scheduled_time_end', lead_row.scheduled_time_end
    ),
    'schedule', CASE
      WHEN schedule_row.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', schedule_row.id,
        'scheduled_date', schedule_row.scheduled_date,
        'scheduled_time_start', schedule_row.scheduled_time_start,
        'scheduled_time_end', schedule_row.scheduled_time_end
      )
    END,
    'trigger', jsonb_build_object(
      'source', p_trigger_source,
      'type', global_trigger_type,
      'offset_minutes', global_offset_minutes,
      'offset_value', global_offset_value,
      'offset_unit', global_offset_unit,
      'scheduled_for', scheduled_for_ts
    ),
    'generated_at', now()
  );

  INSERT INTO public.message_automation_events (
    account_id,
    lead_id,
    job_schedule_id,
    trigger_source,
    scheduled_for,
    max_attempts,
    backoff_minutes,
    endpoint_url,
    auth_header_name,
    auth_header_value,
    message_template,
    message_rendered,
    payload
  )
  VALUES (
    p_account_id,
    p_lead_id,
    schedule_row.id,
    p_trigger_source,
    scheduled_for_ts,
    max_attempts,
    backoff_minutes,
    endpoint_url,
    auth_header_name,
    auth_header_value,
    legacy_message_template,
    rendered_message,
    payload
  );
END;
$$;
