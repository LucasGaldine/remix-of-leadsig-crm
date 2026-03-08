/*
  # Fix Leads Account Access for Multi-User Support

  ## Overview
  Fixes an issue where leads without account_id are not visible to account members.
  Also removes old conflicting RLS policies that were checking created_by instead of account_id.

  ## Changes

  1. **Data Migration**
     - Updates all existing leads to set account_id based on the creator's account
     - Ensures no leads are left with null account_id

  2. **RLS Policy Cleanup**
     - Removes old user-based policies that conflict with account-based policies:
       - "Users can view their own leads"
       - "Users can create leads for themselves"
       - "Users can update their own leads"
       - "Users can delete their own leads"
       - "Users can view leads in their account"
       - "Users can create leads in their account"
       - "Users can update leads in their account"
       - "Users can delete leads in their account"
     - These policies were using `created_by = auth.uid()` and `get_user_account_id()`
     - Only keeps the account-based policies that properly support multi-user access

  3. **Constraint Addition**
     - Makes account_id NOT NULL to prevent future issues
     - Ensures all new leads must have an account_id

  ## Result
  After this migration:
  - All leads are properly associated with an account
  - All users within an account can see and manage the account's leads
  - No conflicts between old and new RLS policies
*/

-- First, update all leads to have the correct account_id
-- This sets account_id based on the creator's primary account
UPDATE leads l
SET account_id = (
  SELECT am.account_id 
  FROM account_members am
  WHERE am.user_id = l.created_by
  AND am.is_active = true
  ORDER BY am.created_at ASC
  LIMIT 1
)
WHERE l.account_id IS NULL;

-- Drop the old conflicting policies that check created_by or use get_user_account_id
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads for themselves" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in their account" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their account" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their account" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their account" ON public.leads;

-- Make account_id NOT NULL to prevent this issue in the future
-- Only do this if all leads now have an account_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leads WHERE account_id IS NULL) THEN
    ALTER TABLE leads ALTER COLUMN account_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'Cannot make account_id NOT NULL because some leads still have NULL account_id';
  END IF;
END $$;
