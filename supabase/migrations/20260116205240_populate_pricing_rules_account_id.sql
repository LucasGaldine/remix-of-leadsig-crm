/*
  # Populate account_id for existing pricing rules

  ## Problem
  Existing pricing_rules records have NULL account_id, which causes RLS policy
  violations when trying to query or insert new records.

  ## Changes
  
  1. **Update existing pricing_rules**
     - Set account_id based on the user's primary account
     - Find the account_id from account_members table for each user_id
  
  2. **Make account_id NOT NULL**
     - After populating data, make the column required going forward

  ## Notes
  - Existing pricing rules are matched to the user's first/primary account
  - If a user has multiple accounts, rules are associated with their first account
*/

-- Update existing pricing_rules to set account_id from the user's account_members
UPDATE public.pricing_rules pr
SET account_id = am.account_id
FROM public.account_members am
WHERE pr.user_id = am.user_id
  AND pr.account_id IS NULL;

-- Make account_id NOT NULL going forward
ALTER TABLE public.pricing_rules
  ALTER COLUMN account_id SET NOT NULL;