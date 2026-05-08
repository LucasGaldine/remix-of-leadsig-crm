/*\n  # Add client portal token to customers table\n\n  1. Modified Tables\n    - `customers`\n      - `client_portal_token` (uuid, unique, nullable) - Token for sharing customer portal with clients\n\n  2. Indexes\n    - Partial index on `client_portal_token` for fast lookups\n\n  This enables sharing a single portal link with clients that gives access to all their jobs,\n  making it easier for customers to track all their work in one place.\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'customers' AND column_name = 'client_portal_token'\n  ) THEN\n    ALTER TABLE customers ADD COLUMN client_portal_token uuid UNIQUE DEFAULT NULL;
\n  END IF;
\nEND $$;
\n\nCREATE INDEX IF NOT EXISTS idx_customers_client_portal_token\n  ON customers(client_portal_token)\n  WHERE client_portal_token IS NOT NULL;
\n;
