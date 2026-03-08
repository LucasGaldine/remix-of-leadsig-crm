/*
  # Add Lead Source Field Mappings

  1. New Tables
    - `lead_source_field_mappings`
      - `id` (uuid, primary key)
      - `lead_source_connection_id` (uuid, foreign key to lead_source_connections)
      - `source_field` (text) - The field name from the external source (e.g., "FULL_NAME", "EMAIL")
      - `target_field` (text) - The field name in our leads table (e.g., "name", "email")
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Changes
    - Add unique constraint on (lead_source_connection_id, source_field) to prevent duplicate mappings
    
  3. Security
    - Enable RLS on `lead_source_field_mappings` table
    - Add policy for users to read their own field mappings
    - Add policy for users to insert their own field mappings
    - Add policy for users to update their own field mappings
    - Add policy for users to delete their own field mappings
*/

-- Create lead_source_field_mappings table
CREATE TABLE IF NOT EXISTS lead_source_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_source_connection_id uuid NOT NULL REFERENCES lead_source_connections(id) ON DELETE CASCADE,
  source_field text NOT NULL,
  target_field text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(lead_source_connection_id, source_field)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_field_mappings_connection 
  ON lead_source_field_mappings(lead_source_connection_id);

-- Enable RLS
ALTER TABLE lead_source_field_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own field mappings
CREATE POLICY "Users can read own field mappings"
  ON lead_source_field_mappings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_source_connections
      WHERE lead_source_connections.id = lead_source_field_mappings.lead_source_connection_id
      AND lead_source_connections.user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own field mappings
CREATE POLICY "Users can insert own field mappings"
  ON lead_source_field_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_source_connections
      WHERE lead_source_connections.id = lead_source_field_mappings.lead_source_connection_id
      AND lead_source_connections.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own field mappings
CREATE POLICY "Users can update own field mappings"
  ON lead_source_field_mappings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_source_connections
      WHERE lead_source_connections.id = lead_source_field_mappings.lead_source_connection_id
      AND lead_source_connections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_source_connections
      WHERE lead_source_connections.id = lead_source_field_mappings.lead_source_connection_id
      AND lead_source_connections.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own field mappings
CREATE POLICY "Users can delete own field mappings"
  ON lead_source_field_mappings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_source_connections
      WHERE lead_source_connections.id = lead_source_field_mappings.lead_source_connection_id
      AND lead_source_connections.user_id = auth.uid()
    )
  );