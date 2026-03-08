/*
  # Add crew lead profile relationship
  
  1. Changes
    - Drop and recreate the foreign key constraint to reference profiles instead of auth.users
    - This allows PostgREST to properly join crew lead data
  
  2. Notes
    - We need to ensure profiles.user_id values exist for any crew_lead_id values
    - The profiles table already has a foreign key to auth.users
*/

-- First, let's check if there are any crew_lead_id values that don't have corresponding profiles
DO $$ 
BEGIN
  -- For any crew_lead_id that exists but doesn't have a profile, create one
  INSERT INTO profiles (user_id, full_name)
  SELECT DISTINCT l.crew_lead_id, u.email
  FROM leads l
  JOIN auth.users u ON u.id = l.crew_lead_id
  WHERE l.crew_lead_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = l.crew_lead_id
    )
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Drop the existing foreign key constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_crew_lead_id_fkey;

-- Add new foreign key that references profiles.user_id instead of auth.users.id
ALTER TABLE leads 
ADD CONSTRAINT leads_crew_lead_id_fkey 
FOREIGN KEY (crew_lead_id) 
REFERENCES profiles(user_id) 
ON DELETE SET NULL;
