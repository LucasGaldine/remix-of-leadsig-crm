/*
  # Fix RLS Performance Caching Issue

  1. Problem
    - Session-level caching doesn't work properly with connection pooling
    - May cause cross-user data leakage or cache misses
    
  2. Solution
    - Remove session-level caching from get_user_roles()
    - Keep the optimized has_role() function
    - PostgreSQL will handle query optimization naturally
    
  3. Changes
    - Simplify get_user_roles() to just fetch roles without caching
    - Maintain security while ensuring proper functionality
*/

-- Simplify get_user_roles to remove problematic session caching
CREATE OR REPLACE FUNCTION get_user_roles()
RETURNS TEXT[] AS $$
DECLARE
  roles TEXT[];
BEGIN
  -- Fetch roles for current user
  SELECT ARRAY_AGG(role::TEXT)
  INTO roles
  FROM user_roles
  WHERE user_id = auth.uid();

  RETURN COALESCE(roles, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Keep the optimized has_role function
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  -- For current user, use the roles array (PostgreSQL will cache this within the query)
  IF _user_id = auth.uid() THEN
    RETURN _role::TEXT = ANY(get_user_roles());
  END IF;
  
  -- For other users, do direct lookup
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
