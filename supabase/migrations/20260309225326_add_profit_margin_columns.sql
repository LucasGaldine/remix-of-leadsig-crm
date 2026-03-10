/*
  # Add Profit Margin Support

  1. Changes to `accounts` table
    - Add `default_profit_margin` column (numeric, default 0)
      - Represents the default profit margin percentage to apply to estimates
      - Works the same as default_tax_rate

  2. Changes to `estimates` table
    - Add `profit_margin` column (numeric, default 0)
      - Allows per-estimate profit margin override
      - Editable on each estimate

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add default profit margin to accounts
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS default_profit_margin numeric DEFAULT 0 CHECK (default_profit_margin >= 0 AND default_profit_margin <= 100);

-- Add profit margin to estimates (can be edited per estimate)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS profit_margin numeric DEFAULT 0 CHECK (profit_margin >= 0 AND profit_margin <= 100);
