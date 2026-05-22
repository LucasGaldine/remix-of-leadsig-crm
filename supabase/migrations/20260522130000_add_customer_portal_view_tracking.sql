/*
  # Add customer portal view tracking

  1. Changes
    - Add first/last viewed timestamps to `customers`
    - Add a view counter to `customers`
    - Add optional metadata payload for the most recent view
*/

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_first_viewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS portal_last_viewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS portal_view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_last_view_meta jsonb NULL;
