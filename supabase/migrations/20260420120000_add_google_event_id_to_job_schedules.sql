ALTER TABLE job_schedules
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;
