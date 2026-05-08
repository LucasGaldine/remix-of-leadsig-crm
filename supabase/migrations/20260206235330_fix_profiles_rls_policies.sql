/*\n  # Fix profiles RLS policies for notification preferences\n\n  1. Changes\n    - Drop existing incorrect RLS policies on profiles table\n    - Create new correct policies that check user_id instead of id\n    - Allow users to insert their own profile (checked by user_id)\n    - Allow users to update their own profile (checked by user_id)\n    - Keep the existing policy to view all profiles (for account member lookups)\n\n  2. Security\n    - Users can only insert/update their own profile record\n    - Users can view all profiles (needed for displaying team member names)\n*/\n\nDO $$ BEGIN\n  -- Drop existing policies\n  DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
\n  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
\n  DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
\n\n  -- Create correct policies using user_id\n  CREATE POLICY "Users can insert their own profile"\n    ON profiles\n    FOR INSERT\n    TO authenticated\n    WITH CHECK (user_id = auth.uid());
\n\n  CREATE POLICY "Users can update their own profile"\n    ON profiles\n    FOR UPDATE\n    TO authenticated\n    USING (user_id = auth.uid())\n    WITH CHECK (user_id = auth.uid());
\n\n  CREATE POLICY "Users can view all profiles"\n    ON profiles\n    FOR SELECT\n    TO authenticated\n    USING (true);
\nEND $$;
\n;
