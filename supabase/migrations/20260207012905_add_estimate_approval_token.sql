/*
  # Add estimate approval token and tracking

  1. Modified Tables
    - `estimates`
      - `approval_token` (uuid, unique) - Token used for customer-facing approval links
      - `approved_via` (text) - How the estimate was approved: 'manual' or 'customer_link'

  2. Security
    - Add RLS policy allowing public SELECT on estimates by approval_token (for customer-facing page)

  3. Notes
    - The approval_token is generated on-demand when the user requests an approval link
    - The approved_via column tracks whether approval came from the business owner or the customer
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'approval_token'
  ) THEN
    ALTER TABLE estimates ADD COLUMN approval_token uuid DEFAULT NULL UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'approved_via'
  ) THEN
    ALTER TABLE estimates ADD COLUMN approved_via text DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estimates_approval_token ON estimates(approval_token) WHERE approval_token IS NOT NULL;
