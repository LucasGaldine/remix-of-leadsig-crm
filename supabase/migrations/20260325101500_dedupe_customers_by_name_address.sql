-- Deduplicate customers by normalized (account_id, name, address).
-- Keeps the oldest record (created_at, then id) and rewires all FK references
-- to the canonical row before deleting duplicates.

BEGIN;
CREATE TEMP TABLE tmp_customer_dedup_map (
  duplicate_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL
) ON COMMIT DROP;
WITH ranked AS (
  SELECT
    c.id,
    c.account_id,
    lower(btrim(c.name)) AS norm_name,
    lower(btrim(c.address)) AS norm_address,
    c.created_at,
    row_number() OVER (
      PARTITION BY c.account_id, lower(btrim(c.name)), lower(btrim(c.address))
      ORDER BY c.created_at ASC NULLS LAST, c.id ASC
    ) AS rn,
    first_value(c.id) OVER (
      PARTITION BY c.account_id, lower(btrim(c.name)), lower(btrim(c.address))
      ORDER BY c.created_at ASC NULLS LAST, c.id ASC
    ) AS keep_id
  FROM public.customers c
  WHERE c.name IS NOT NULL
    AND btrim(c.name) <> ''
    AND c.address IS NOT NULL
    AND btrim(c.address) <> ''
)
INSERT INTO tmp_customer_dedup_map (duplicate_id, canonical_id)
SELECT r.id, r.keep_id
FROM ranked r
WHERE r.rn > 1
  AND r.id <> r.keep_id;
DO $$
DECLARE
  fk_record RECORD;
  touched_rows bigint;
BEGIN
  FOR fk_record IN
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'customers'
      AND ccu.column_name = 'id'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I t
       SET %I = m.canonical_id
       FROM tmp_customer_dedup_map m
       WHERE t.%I = m.duplicate_id
         AND t.%I IS DISTINCT FROM m.canonical_id',
      fk_record.table_schema,
      fk_record.table_name,
      fk_record.column_name,
      fk_record.column_name,
      fk_record.column_name
    );

    GET DIAGNOSTICS touched_rows = ROW_COUNT;
    RAISE NOTICE 'Re-pointed % row(s) in %.% via column %',
      touched_rows,
      fk_record.table_schema,
      fk_record.table_name,
      fk_record.column_name;
  END LOOP;
END $$;
DELETE FROM public.customers c
USING tmp_customer_dedup_map m
WHERE c.id = m.duplicate_id;
COMMIT;
