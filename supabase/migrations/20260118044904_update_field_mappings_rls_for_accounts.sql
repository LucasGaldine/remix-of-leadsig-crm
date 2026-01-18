/*
  # Update Field Mappings RLS for Account-Based Access

  ## Overview
  Updates RLS policies on lead_source_field_mappings to use account-based access control
  instead of user-based, matching the pattern used for lead_source_connections.

  ## Changes
  1. Drop old user-based RLS policies
  2. Create new account-based RLS policies
  
  ## Security Model
  - Account members can manage field mappings for their account's connections
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own field mappings" ON public.lead_source_field_mappings;
DROP POLICY IF EXISTS "Users can insert own field mappings" ON public.lead_source_field_mappings;
DROP POLICY IF EXISTS "Users can update own field mappings" ON public.lead_source_field_mappings;
DROP POLICY IF EXISTS "Users can delete own field mappings" ON public.lead_source_field_mappings;

-- Create account-based policies
CREATE POLICY "Account members can view field mappings"
  ON public.lead_source_field_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_source_connections lsc
      INNER JOIN account_members am ON am.account_id = lsc.account_id
      WHERE lsc.id = lead_source_field_mappings.lead_source_connection_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE POLICY "Account members can create field mappings"
  ON public.lead_source_field_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_source_connections lsc
      INNER JOIN account_members am ON am.account_id = lsc.account_id
      WHERE lsc.id = lead_source_field_mappings.lead_source_connection_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE POLICY "Account members can update field mappings"
  ON public.lead_source_field_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_source_connections lsc
      INNER JOIN account_members am ON am.account_id = lsc.account_id
      WHERE lsc.id = lead_source_field_mappings.lead_source_connection_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_source_connections lsc
      INNER JOIN account_members am ON am.account_id = lsc.account_id
      WHERE lsc.id = lead_source_field_mappings.lead_source_connection_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

CREATE POLICY "Account members can delete field mappings"
  ON public.lead_source_field_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_source_connections lsc
      INNER JOIN account_members am ON am.account_id = lsc.account_id
      WHERE lsc.id = lead_source_field_mappings.lead_source_connection_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );
