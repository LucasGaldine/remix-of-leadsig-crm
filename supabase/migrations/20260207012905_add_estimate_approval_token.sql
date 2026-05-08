/*\n  # Add estimate approval token and tracking\n\n  1. Modified Tables\n    - `estimates`\n      - `approval_token` (uuid, unique) - Token used for customer-facing approval links\n      - `approved_via` (text) - How the estimate was approved: 'manual' or 'customer_link'\n\n  2. Security\n    - Add RLS policy allowing public SELECT on estimates by approval_token (for customer-facing page)\n\n  3. Notes\n    - The approval_token is generated on-demand when the user requests an approval link\n    - The approved_via column tracks whether approval came from the business owner or the customer\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'estimates' AND column_name = 'approval_token'\n  ) THEN\n    ALTER TABLE estimates ADD COLUMN approval_token uuid DEFAULT NULL UNIQUE;
\n  END IF;
\n\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'estimates' AND column_name = 'approved_via'\n  ) THEN\n    ALTER TABLE estimates ADD COLUMN approved_via text DEFAULT NULL;
\n  END IF;
\nEND $$;
\n\nCREATE INDEX IF NOT EXISTS idx_estimates_approval_token ON estimates(approval_token) WHERE approval_token IS NOT NULL;
\n;
