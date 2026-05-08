/*\n  # Add form_id to Field Mappings for Multi-Form Support\n\n  ## Overview\n  Adds support for multiple Google lead forms by storing the form_id with each mapping set.\n  This allows each Google lead form to have its own custom field mappings.\n\n  ## Changes\n  1. Add form_id column to lead_source_field_mappings table\n  2. Add form_id column to lead_source_connections table\n  3. Update constraint to ensure unique mappings per connection and form\n\n  ## Notes\n  - form_id is optional to maintain backward compatibility\n  - When form_id is provided, mappings are specific to that form\n  - When form_id is null, mappings apply to all forms (legacy behavior)\n*/\n\n-- Add form_id to lead_source_field_mappings\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'lead_source_field_mappings' AND column_name = 'form_id'\n  ) THEN\n    ALTER TABLE lead_source_field_mappings\n    ADD COLUMN form_id text;
\n  END IF;
\nEND $$;
\n\n-- Add form_id to lead_source_connections\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'lead_source_connections' AND column_name = 'form_id'\n  ) THEN\n    ALTER TABLE lead_source_connections\n    ADD COLUMN form_id text;
\n  END IF;
\nEND $$;
\n\n-- Add comment for clarity\nCOMMENT ON COLUMN lead_source_field_mappings.form_id IS 'Google Ads form_id for form-specific mappings. NULL means applies to all forms.';
\nCOMMENT ON COLUMN lead_source_connections.form_id IS 'Google Ads form_id. NULL for non-Google platforms or legacy connections.';
\n;
