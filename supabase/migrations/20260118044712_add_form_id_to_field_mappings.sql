/*
  # Add form_id to Field Mappings for Multi-Form Support

  ## Overview
  Adds support for multiple Google lead forms by storing the form_id with each mapping set.
  This allows each Google lead form to have its own custom field mappings.

  ## Changes
  1. Add form_id column to lead_source_field_mappings table
  2. Add form_id column to lead_source_connections table
  3. Update constraint to ensure unique mappings per connection and form

  ## Notes
  - form_id is optional to maintain backward compatibility
  - When form_id is provided, mappings are specific to that form
  - When form_id is null, mappings apply to all forms (legacy behavior)
*/

-- Add form_id to lead_source_field_mappings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_source_field_mappings' AND column_name = 'form_id'
  ) THEN
    ALTER TABLE lead_source_field_mappings
    ADD COLUMN form_id text;
  END IF;
END $$;

-- Add form_id to lead_source_connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_source_connections' AND column_name = 'form_id'
  ) THEN
    ALTER TABLE lead_source_connections
    ADD COLUMN form_id text;
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON COLUMN lead_source_field_mappings.form_id IS 'Google Ads form_id for form-specific mappings. NULL means applies to all forms.';
COMMENT ON COLUMN lead_source_connections.form_id IS 'Google Ads form_id. NULL for non-Google platforms or legacy connections.';
