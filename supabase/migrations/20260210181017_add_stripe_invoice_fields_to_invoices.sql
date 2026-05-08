/*\n  # Add Stripe Invoice fields to invoices table\n\n  1. Modified Tables\n    - `invoices`\n      - `stripe_invoice_id` (text) - Stripe Invoice ID for tracking\n      - `stripe_invoice_url` (text) - Hosted Stripe Invoice URL for customer payment\n\n  2. Important Notes\n    - These columns allow linking a local invoice to a Stripe-hosted invoice\n    - The URL is surfaced in the client portal so customers can pay online\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_id'\n  ) THEN\n    ALTER TABLE invoices ADD COLUMN stripe_invoice_id text;
\n  END IF;
\n\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_url'\n  ) THEN\n    ALTER TABLE invoices ADD COLUMN stripe_invoice_url text;
\n  END IF;
\nEND $$;
\n;
