/*\n  # Add Remaining Foreign Key Indexes\n\n  These 5 foreign keys were previously dropped as "unused" but are required\n  for join/delete performance on foreign key columns.\n\n  1. New Indexes\n    - `idx_days_off_created_by` on days_off(created_by)\n    - `idx_estimate_change_orders_changed_by` on estimate_change_orders(changed_by)\n    - `idx_estimate_line_items_original_line_item_id` on estimate_line_items(original_line_item_id)\n    - `idx_job_assignments_assigned_by` on job_assignments(assigned_by)\n    - `idx_job_schedules_created_by` on job_schedules(created_by)\n*/\n\nCREATE INDEX IF NOT EXISTS idx_days_off_created_by ON days_off(created_by);
\nCREATE INDEX IF NOT EXISTS idx_estimate_change_orders_changed_by ON estimate_change_orders(changed_by);
\nCREATE INDEX IF NOT EXISTS idx_estimate_line_items_original_line_item_id ON estimate_line_items(original_line_item_id);
\nCREATE INDEX IF NOT EXISTS idx_job_assignments_assigned_by ON job_assignments(assigned_by);
\nCREATE INDEX IF NOT EXISTS idx_job_schedules_created_by ON job_schedules(created_by);
;
