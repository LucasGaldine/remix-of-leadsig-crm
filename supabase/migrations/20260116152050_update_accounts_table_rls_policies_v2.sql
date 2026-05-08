/*\n  # Update Accounts Table RLS Policies\n  \n  ## Overview\n  Update accounts table RLS policies to use the security definer functions\n  \n  ## Changes\n  - Users can view their own account\n  - Users can update their own account\n  - Use security definer functions instead of direct queries\n  \n  ## Security\n  - No circular dependencies\n  - Users can only access their own account data\n*/\n\n-- Drop ALL existing policies\nDROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
\nDROP POLICY IF EXISTS "Users can update their own account" ON public.accounts;
\nDROP POLICY IF EXISTS "Users can view accounts they are members of" ON public.accounts;
\nDROP POLICY IF EXISTS "Account owners and admins can update their account" ON public.accounts;
\nDROP POLICY IF EXISTS "Users can create accounts" ON public.accounts;
\n\n-- Create new policies using security definer function\nCREATE POLICY "Users can view their own account"\n  ON public.accounts FOR SELECT\n  TO authenticated\n  USING (\n    id = get_user_account_id(auth.uid())\n  );
\n\nCREATE POLICY "Users can update their own account"\n  ON public.accounts FOR UPDATE\n  TO authenticated\n  USING (\n    id = get_user_account_id(auth.uid())\n  )\n  WITH CHECK (\n    id = get_user_account_id(auth.uid())\n  );
\n\n-- Allow users to insert accounts (for new account creation)\nCREATE POLICY "Users can create accounts"\n  ON public.accounts FOR INSERT\n  TO authenticated\n  WITH CHECK (true);
;
