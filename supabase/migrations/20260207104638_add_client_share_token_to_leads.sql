/*\n  # Add client share token to leads table\n\n  1. Modified Tables\n    - `leads`\n      - `client_share_token` (uuid, unique, nullable) - Token for sharing job details with clients who don't have accounts\n\n  2. Indexes\n    - Partial index on `client_share_token` for fast lookups\n\n  This enables sharing a public link with clients so they can view their job status,\n  estimate, photos, and scheduled dates without needing a LeadSig account.\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'leads' AND column_name = 'client_share_token'\n  ) THEN\n    ALTER TABLE leads ADD COLUMN client_share_token uuid UNIQUE DEFAULT NULL;
\n  END IF;
\nEND $$;
\n\nCREATE INDEX IF NOT EXISTS idx_leads_client_share_token\n  ON leads(client_share_token)\n  WHERE client_share_token IS NOT NULL;
\n;
