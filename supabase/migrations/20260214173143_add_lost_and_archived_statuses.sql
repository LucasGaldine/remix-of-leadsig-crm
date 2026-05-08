/*\n  # Add lost and archived statuses\n\n  1. Changes\n    - Add `lost` value to `unified_status` enum for leads marked as lost\n    - Add `archived` value to `unified_status` enum for completed jobs that are archived\n  \n  2. Purpose\n    - Allows users to mark leads as lost instead of deleting them\n    - Allows users to archive completed jobs\n    - Both statuses are visible in the Archive section of the Leads page\n*/\n\nALTER TYPE unified_status ADD VALUE IF NOT EXISTS 'lost';
\nALTER TYPE unified_status ADD VALUE IF NOT EXISTS 'archived';
\n;
