/*
  # Add Job Checklist Items

  1. New Tables
    - `job_checklist_items`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references leads.id with cascade delete)
      - `account_id` (uuid, references accounts.id)
      - `label` (text, the checklist item text)
      - `is_completed` (boolean, default false)
      - `sort_order` (integer, for ordering items)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `job_checklist_items` table
    - Add policies for account members to select, insert, update, delete

  3. Triggers
    - Auto-create default checklist items when a job is created
      - "Navigate to address" for all jobs
      - "Send client portal" for estimate visit jobs
    - Auto-complete job when all checklist items are marked completed

  4. Indexes
    - Index on job_id for fast lookups
    - Index on account_id for RLS performance
*/

CREATE TABLE IF NOT EXISTS job_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id),
  label text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_job_id ON job_checklist_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_account_id ON job_checklist_items(account_id);

CREATE POLICY "Account members can view checklist items"
  ON job_checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = job_checklist_items.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

CREATE POLICY "Account members can insert checklist items"
  ON job_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = job_checklist_items.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

CREATE POLICY "Account members can update checklist items"
  ON job_checklist_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = job_checklist_items.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = job_checklist_items.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

CREATE POLICY "Account members can delete checklist items"
  ON job_checklist_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = job_checklist_items.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );

-- Trigger function: create default checklist items when a job is created
CREATE OR REPLACE FUNCTION create_default_checklist_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'job' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'job')) THEN
    INSERT INTO job_checklist_items (job_id, account_id, label, sort_order)
    VALUES (NEW.id, NEW.account_id, 'Navigate to address', 0);

    IF NEW.is_estimate_visit = true THEN
      INSERT INTO job_checklist_items (job_id, account_id, label, sort_order)
      VALUES (NEW.id, NEW.account_id, 'Send client portal', 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_checklist_items
  AFTER INSERT OR UPDATE OF status ON leads
  FOR EACH ROW
  EXECUTE FUNCTION create_default_checklist_items();

-- Trigger function: auto-complete job when all checklist items are completed
CREATE OR REPLACE FUNCTION auto_complete_job_on_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
  completed_count integer;
  current_status unified_status;
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN
    SELECT count(*), count(*) FILTER (WHERE is_completed = true)
    INTO total_count, completed_count
    FROM job_checklist_items
    WHERE job_id = NEW.job_id;

    IF total_count > 0 AND total_count = completed_count THEN
      SELECT status INTO current_status FROM leads WHERE id = NEW.job_id;

      IF current_status = 'job' THEN
        UPDATE leads SET status = 'completed' WHERE id = NEW.job_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_complete_job_on_checklist
  AFTER UPDATE OF is_completed ON job_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_job_on_checklist();
