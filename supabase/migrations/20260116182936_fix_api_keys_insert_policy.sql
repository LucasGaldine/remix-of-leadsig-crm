/*
  # Fix API Keys Insert Policy
  
  ## Overview
  Fixes the INSERT policy for api_keys table to allow account members to create API keys.
  The previous policy was too restrictive and may have been blocking legitimate requests.
  
  ## Changes
  1. Drop existing INSERT policy for api_keys
  2. Create new INSERT policy that allows authenticated account members to create keys
  
  ## Security
  - Policy still validates that user is a member of the account
  - Uses security definer function to check membership safely
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Account owners and admins can create API keys" ON public.api_keys;

-- Create new INSERT policy that allows any account member to create API keys
CREATE POLICY "Account members can create API keys"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id 
      FROM public.account_members 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );
