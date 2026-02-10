/*
  # Fix account_members_with_profiles view - add missing id column

  1. Modified Views
    - `account_members_with_profiles`
      - Added `id` column from account_members table
      - This was missing and causing 400 errors when querying the view

  2. Important Notes
    - The view is dropped and recreated with the id column included
    - No data is affected since this is just a view
*/

DROP VIEW IF EXISTS account_members_with_profiles;

CREATE VIEW account_members_with_profiles AS
SELECT
  am.id,
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
