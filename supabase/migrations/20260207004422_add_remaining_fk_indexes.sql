/*
  # Add Remaining Foreign Key Indexes

  These 5 foreign keys were previously dropped as "unused" but are required
  for join/delete performance on foreign key columns.

  1. New Indexes
    - `idx_days_off_created_by` on days_off(created_by)
    - `idx_estimate_change_orders_changed_by` on estimate_change_orders(changed_by)
    - `idx_estimate_line_items_original_line_item_id` on estimate_line_items(original_line_item_id)
    - `idx_job_assignments_assigned_by` on job_assignments(assigned_by)
    - `idx_job_schedules_created_by` on job_schedules(created_by)
*/

DO $$
DECLARE
  idx record;
BEGIN
  FOR idx IN
    SELECT * FROM (
      VALUES
        ('idx_days_off_created_by', 'days_off', 'created_by'),
        ('idx_estimate_change_orders_changed_by', 'estimate_change_orders', 'changed_by'),
        ('idx_estimate_line_items_original_line_item_id', 'estimate_line_items', 'original_line_item_id'),
        ('idx_job_assignments_assigned_by', 'job_assignments', 'assigned_by'),
        ('idx_job_schedules_created_by', 'job_schedules', 'created_by')
    ) AS t(index_name, table_name, column_name)
  LOOP
    IF to_regclass(format('public.%I', idx.table_name)) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = idx.table_name
          AND column_name = idx.column_name
      ) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(%I)',
        idx.index_name,
        idx.table_name,
        idx.column_name
      );
    END IF;
  END LOOP;
END $$;
;
