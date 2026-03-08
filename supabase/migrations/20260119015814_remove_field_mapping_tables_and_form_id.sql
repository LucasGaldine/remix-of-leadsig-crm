/*
  # Remove Field Mapping Tables and Form ID

  This migration removes the manual field mapping system and form_id tracking in favor of AI-powered lead parsing.

  ## Changes

  1. Tables Dropped
    - `lead_source_field_mappings` - No longer needed with AI parsing
    - `lead_source_setup_sessions` - Test payload collection not required

  2. Columns Removed
    - `lead_source_connections.form_id` - Form-specific tracking no longer needed

  ## Rationale

  The AI-powered lead intelligence system automatically extracts all fields from any lead source format,
  eliminating the need for manual field mapping configuration and test data collection.
*/

-- Drop tables (CASCADE to remove dependent objects)
DROP TABLE IF EXISTS lead_source_field_mappings CASCADE;
DROP TABLE IF EXISTS lead_source_setup_sessions CASCADE;

-- Remove form_id column from lead_source_connections
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_source_connections' AND column_name = 'form_id'
  ) THEN
    ALTER TABLE lead_source_connections DROP COLUMN form_id;
  END IF;
END $$;
