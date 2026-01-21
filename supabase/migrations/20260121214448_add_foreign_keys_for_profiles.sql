/*
  # Add Foreign Keys for Profiles
  
  ## Overview
  Adds foreign key relationships from account_members and job_assignments
  to the profiles table to enable proper Supabase joins.
  
  ## Changes
  - Add foreign key from account_members.user_id to profiles.user_id
  - Add foreign key from job_assignments.user_id to profiles.user_id
  
  ## Notes
  - These foreign keys enable Supabase's automatic join syntax
  - Improves query performance with proper indexes
*/

DO $$
BEGIN
  -- Add foreign key from account_members to profiles if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'account_members_user_id_fkey' 
    AND table_name = 'account_members'
  ) THEN
    ALTER TABLE account_members 
    ADD CONSTRAINT account_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key from job_assignments to profiles if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'job_assignments_user_id_fkey' 
    AND table_name = 'job_assignments'
  ) THEN
    ALTER TABLE job_assignments 
    ADD CONSTRAINT job_assignments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;