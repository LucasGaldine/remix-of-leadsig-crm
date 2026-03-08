/*
  # Fix profiles RLS policies to use user_id column

  1. Changes
    - Update INSERT policy to check `user_id = auth.uid()` instead of `id = auth.uid()`
    - Update UPDATE policy to check `user_id = auth.uid()` instead of `id = auth.uid()`
    - SELECT policy left unchanged (already allows viewing all profiles)

  2. Security
    - Users can only insert/update their own profile row
    - Ownership verified via user_id matching authenticated user
*/

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
