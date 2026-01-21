/*
  # Create view for account members with profiles

  1. New Objects
    - `account_members_with_profiles` view
      - Joins account_members with profiles through user_id
      - Makes it easy to fetch member data with profile information
  
  2. Purpose
    - Simplifies querying account members with their profile data
    - Works around PostgREST limitation of joining tables that both reference auth.users
*/

CREATE OR REPLACE VIEW account_members_with_profiles AS
SELECT 
  am.id,
  am.account_id,
  am.user_id,
  am.role,
  am.invited_by,
  am.invited_at,
  am.joined_at,
  am.is_active,
  am.created_at,
  am.updated_at,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url
FROM account_members am
LEFT JOIN profiles p ON am.user_id = p.user_id;

-- Grant access to authenticated users
GRANT SELECT ON account_members_with_profiles TO authenticated;