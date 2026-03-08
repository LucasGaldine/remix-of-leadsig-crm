/*
  # Add Performance Index for Jobs Table

  1. Performance Improvement
    - Add index on `jobs.created_by` column to improve query performance
    - This index will speed up filtering and joins on the created_by field
    - Complements existing indexes on customer_id, crew_lead_id, lead_id, scheduled_date, and status

  2. Notes
    - Uses IF NOT EXISTS to prevent errors if index already exists
    - This is a non-blocking operation that improves read performance
*/

CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs USING btree (created_by);
