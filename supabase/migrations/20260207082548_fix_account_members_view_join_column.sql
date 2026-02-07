/*
  # Fix account_members_with_profiles view join column

  1. Modified Views
    - `account_members_with_profiles` - fixed join to use `profiles.user_id` instead of `profiles.id`
  
  2. Reason
    - The profiles table has a separate `user_id` column that corresponds to `account_members.user_id`
    - The previous join on `profiles.id` produced no matches, causing all names to show as "Unknown"
*/

DROP VIEW IF EXISTS account_members_with_profiles;

CREATE VIEW account_members_with_profiles AS
SELECT
  am.account_id,
  am.user_id,
  am.role,
  am.invited_by,
  am.invited_at,
  am.joined_at,
  am.is_active,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url
FROM account_members am
LEFT JOIN profiles p ON am.user_id = p.user_id;
