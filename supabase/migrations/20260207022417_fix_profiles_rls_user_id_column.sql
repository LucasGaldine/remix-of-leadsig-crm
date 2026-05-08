/*\n  # Fix profiles RLS policies to use user_id column\n\n  1. Changes\n    - Update INSERT policy to check `user_id = auth.uid()` instead of `id = auth.uid()`\n    - Update UPDATE policy to check `user_id = auth.uid()` instead of `id = auth.uid()`\n    - SELECT policy left unchanged (already allows viewing all profiles)\n\n  2. Security\n    - Users can only insert/update their own profile row\n    - Ownership verified via user_id matching authenticated user\n*/\n\nDROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
\nCREATE POLICY "Users can insert their own profile"\n  ON profiles FOR INSERT\n  TO authenticated\n  WITH CHECK (user_id = (SELECT auth.uid()));
\n\nDROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
\nCREATE POLICY "Users can update their own profile"\n  ON profiles FOR UPDATE\n  TO authenticated\n  USING (user_id = (SELECT auth.uid()))\n  WITH CHECK (user_id = (SELECT auth.uid()));
\n;
