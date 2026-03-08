/*
  # Add is_active column to account_members_with_profiles view

  1. Modified Views
    - `account_members_with_profiles` - added `is_active` column from account_members table
  
  2. Reason
    - The view was missing the `is_active` column, causing queries that filter by
      `is_active` to fail silently and return no results (e.g. crew member assignment dropdown)
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
LEFT JOIN profiles p ON am.user_id = p.id;
