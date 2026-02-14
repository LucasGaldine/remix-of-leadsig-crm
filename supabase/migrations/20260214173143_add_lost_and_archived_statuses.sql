/*
  # Add lost and archived statuses

  1. Changes
    - Add `lost` value to `unified_status` enum for leads marked as lost
    - Add `archived` value to `unified_status` enum for completed jobs that are archived
  
  2. Purpose
    - Allows users to mark leads as lost instead of deleting them
    - Allows users to archive completed jobs
    - Both statuses are visible in the Archive section of the Leads page
*/

ALTER TYPE unified_status ADD VALUE IF NOT EXISTS 'lost';
ALTER TYPE unified_status ADD VALUE IF NOT EXISTS 'archived';
