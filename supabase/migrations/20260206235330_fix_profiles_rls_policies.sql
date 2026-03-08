/*
  # Fix profiles RLS policies for notification preferences

  1. Changes
    - Drop existing incorrect RLS policies on profiles table
    - Create new correct policies that check user_id instead of id
    - Allow users to insert their own profile (checked by user_id)
    - Allow users to update their own profile (checked by user_id)
    - Keep the existing policy to view all profiles (for account member lookups)

  2. Security
    - Users can only insert/update their own profile record
    - Users can view all profiles (needed for displaying team member names)
*/

DO $$ BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

  -- Create correct policies using user_id
  CREATE POLICY "Users can insert their own profile"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY "Users can update their own profile"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY "Users can view all profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (true);
END $$;
