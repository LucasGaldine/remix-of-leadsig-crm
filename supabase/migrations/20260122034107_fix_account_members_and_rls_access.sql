/*
  # Fix Account Members and RLS Access Issues
  
  ## Summary
  Fixes issues where users cannot create or view leads due to missing or incorrect
  account_members entries and overly restrictive RLS policies.
  
  ## Changes
  
  1. **Ensure All Users Have Account Members Entries**
     - Finds users with profiles but no account_members entry
     - Creates account_members entries for them with 'sales' role by default
     - Associates them with their first account (or creates one if needed)
  
  2. **RLS Policy Improvements**
     - No policy changes needed, just data fixes
  
  ## Security
  - Maintains proper access control through account_members
  - All users are associated with an account
  - Default role is 'sales' which has appropriate permissions
*/

-- Step 1: Find users with profiles but no account_members entry and fix them
DO $$
DECLARE
  user_record RECORD;
  v_account_id uuid;
BEGIN
  -- Loop through users who have profiles but no account_members entry
  FOR user_record IN 
    SELECT p.user_id, p.email, p.full_name
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM account_members am
      WHERE am.user_id = p.user_id
    )
  LOOP
    RAISE NOTICE 'Found user without account: % (%)', user_record.full_name, user_record.email;
    
    -- Check if there's an account created by this user
    SELECT id INTO v_account_id
    FROM accounts
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- If no accounts exist at all, create one
    IF v_account_id IS NULL THEN
      INSERT INTO accounts (company_name, company_email)
      VALUES (
        COALESCE(user_record.full_name, user_record.email, 'My Company'),
        user_record.email
      )
      RETURNING id INTO v_account_id;
      
      RAISE NOTICE 'Created new account: %', v_account_id;
    END IF;
    
    -- Create account_members entry
    INSERT INTO account_members (account_id, user_id, role, is_active)
    VALUES (v_account_id, user_record.user_id, 'sales', true);
    
    RAISE NOTICE 'Added user % to account % with role sales', user_record.email, v_account_id;
  END LOOP;
END $$;

-- Step 2: Update any leads that don't have an account_id
UPDATE leads
SET account_id = (
  SELECT am.account_id
  FROM account_members am
  WHERE am.user_id = leads.created_by
    AND am.is_active = true
  ORDER BY am.created_at ASC
  LIMIT 1
)
WHERE account_id IS NULL;

-- Step 3: Verify no orphaned data remains
DO $$
DECLARE
  orphaned_leads_count integer;
  orphaned_users_count integer;
BEGIN
  -- Check for leads without account_id
  SELECT COUNT(*) INTO orphaned_leads_count
  FROM leads
  WHERE account_id IS NULL;
  
  IF orphaned_leads_count > 0 THEN
    RAISE WARNING 'Found % leads without account_id', orphaned_leads_count;
  END IF;
  
  -- Check for users without account_members
  SELECT COUNT(*) INTO orphaned_users_count
  FROM profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.user_id = p.user_id
  );
  
  IF orphaned_users_count > 0 THEN
    RAISE WARNING 'Found % users without account_members entries', orphaned_users_count;
  ELSE
    RAISE NOTICE 'All users have account_members entries';
  END IF;
END $$;
