/*\n  # Remove Field Mapping Tables and Form ID\n\n  This migration removes the manual field mapping system and form_id tracking in favor of AI-powered lead parsing.\n\n  ## Changes\n\n  1. Tables Dropped\n    - `lead_source_field_mappings` - No longer needed with AI parsing\n    - `lead_source_setup_sessions` - Test payload collection not required\n\n  2. Columns Removed\n    - `lead_source_connections.form_id` - Form-specific tracking no longer needed\n\n  ## Rationale\n\n  The AI-powered lead intelligence system automatically extracts all fields from any lead source format,\n  eliminating the need for manual field mapping configuration and test data collection.\n*/\n\n-- Drop tables (CASCADE to remove dependent objects)\nDROP TABLE IF EXISTS lead_source_field_mappings CASCADE;
\nDROP TABLE IF EXISTS lead_source_setup_sessions CASCADE;
\n\n-- Remove form_id column from lead_source_connections\nDO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'lead_source_connections' AND column_name = 'form_id'\n  ) THEN\n    ALTER TABLE lead_source_connections DROP COLUMN form_id;
\n  END IF;
\nEND $$;
\n;
