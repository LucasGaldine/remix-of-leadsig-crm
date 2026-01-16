/*
  # Add Account Invite Codes
  
  ## Overview
  Adds invite code functionality to allow users to join existing accounts.
  Each account gets a unique, shareable invite code.
  
  ## Changes
  
  1. Add invite_code column to accounts table
  2. Create function to generate unique invite codes
  3. Generate codes for existing accounts
  4. Add index for fast lookups
  
  ## Security
  
  - Invite codes are random 8-character alphanumeric strings
  - Codes are case-insensitive for user convenience
  - Users can look up accounts by invite code to join
*/

-- Function to generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed ambiguous chars
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Add invite_code column to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Generate invite codes for existing accounts
DO $$
DECLARE
  account_record RECORD;
  new_code text;
  code_exists boolean;
BEGIN
  FOR account_record IN SELECT id FROM public.accounts WHERE invite_code IS NULL
  LOOP
    LOOP
      new_code := generate_invite_code();
      
      -- Check if code already exists
      SELECT EXISTS(
        SELECT 1 FROM public.accounts WHERE invite_code = new_code
      ) INTO code_exists;
      
      EXIT WHEN NOT code_exists;
    END LOOP;
    
    UPDATE public.accounts 
    SET invite_code = new_code 
    WHERE id = account_record.id;
  END LOOP;
END $$;

-- Make invite_code NOT NULL after populating existing records
ALTER TABLE public.accounts ALTER COLUMN invite_code SET NOT NULL;

-- Add index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_accounts_invite_code ON public.accounts(invite_code);

-- Function to auto-generate invite code on account creation
CREATE OR REPLACE FUNCTION auto_generate_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  IF NEW.invite_code IS NULL THEN
    LOOP
      new_code := generate_invite_code();
      
      SELECT EXISTS(
        SELECT 1 FROM public.accounts WHERE invite_code = new_code
      ) INTO code_exists;
      
      EXIT WHEN NOT code_exists;
    END LOOP;
    
    NEW.invite_code := new_code;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to auto-generate invite codes
DROP TRIGGER IF EXISTS trigger_auto_generate_invite_code ON public.accounts;
CREATE TRIGGER trigger_auto_generate_invite_code
  BEFORE INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invite_code();

-- Helper function to find account by invite code
CREATE OR REPLACE FUNCTION public.get_account_by_invite_code(code text)
RETURNS TABLE (
  id uuid,
  company_name text,
  invite_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, company_name, invite_code
  FROM public.accounts
  WHERE UPPER(invite_code) = UPPER(code);
$$;