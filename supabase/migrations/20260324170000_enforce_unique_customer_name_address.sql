-- Prevent duplicate customers per account when both name and address are provided.
DROP INDEX IF EXISTS public.idx_customers_unique_address;
CREATE UNIQUE INDEX IF NOT EXISTS customers_account_name_address_unique
ON public.customers (
  account_id,
  lower(btrim(name)),
  lower(btrim(address))
)
WHERE name IS NOT NULL
  AND btrim(name) <> ''
  AND address IS NOT NULL
  AND btrim(address) <> '';
