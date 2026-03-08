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

CREATE INDEX IF NOT EXISTS idx_days_off_created_by ON days_off(created_by);
CREATE INDEX IF NOT EXISTS idx_estimate_change_orders_changed_by ON estimate_change_orders(changed_by);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_original_line_item_id ON estimate_line_items(original_line_item_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_assigned_by ON job_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_job_schedules_created_by ON job_schedules(created_by);