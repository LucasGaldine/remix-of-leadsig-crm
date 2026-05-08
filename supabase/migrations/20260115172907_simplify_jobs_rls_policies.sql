/*\n  # Simplify Jobs RLS Policies\n\n  1. Changes\n    - Drop all restrictive RLS policies on leads table\n    - Keep only the simple policy that allows authenticated users full access\n  \n  2. Security\n    - Authenticated users can view, create, update, and delete all leads/jobs\n    - No ownership or assignment checks required\n*/\n\n-- Drop the restrictive policies\nDROP POLICY IF EXISTS "Users can view their leads and jobs" ON leads;
\nDROP POLICY IF EXISTS "Users can create leads and jobs" ON leads;
\nDROP POLICY IF EXISTS "Users can update their leads and jobs" ON leads;
\nDROP POLICY IF EXISTS "Users can delete their leads and jobs" ON leads;
\n\n-- Ensure the permissive "all access" policy exists\nDROP POLICY IF EXISTS "Authenticated users have full access to leads" ON leads;
\n\nCREATE POLICY "Authenticated users have full access to leads"\n  ON leads\n  FOR ALL\n  TO authenticated\n  USING (true)\n  WITH CHECK (true);
\n;
