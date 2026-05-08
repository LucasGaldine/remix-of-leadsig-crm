/*\n  # Add pricing plan to accounts\n\n  1. Modified Tables\n    - `accounts`\n      - `pricing_plan` (text, default 'free') - The company's current subscription plan (free, basic, premium)\n\n  2. Notes\n    - Defaults to 'free' for all existing and new accounts\n    - Constrained to only allow valid plan values\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'accounts' AND column_name = 'pricing_plan'\n  ) THEN\n    ALTER TABLE accounts ADD COLUMN pricing_plan text NOT NULL DEFAULT 'free';
\n    ALTER TABLE accounts ADD CONSTRAINT accounts_pricing_plan_check\n      CHECK (pricing_plan IN ('free', 'basic', 'premium'));
\n  END IF;
\nEND $$;
\n;
