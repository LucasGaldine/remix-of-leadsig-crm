ALTER TABLE public.job_checklist_items
  ADD COLUMN IF NOT EXISTS metadata jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_checklist_items_metadata_is_object'
  ) THEN
    ALTER TABLE public.job_checklist_items
      ADD CONSTRAINT job_checklist_items_metadata_is_object
      CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_checklist_items_metadata_category_valid'
  ) THEN
    ALTER TABLE public.job_checklist_items
      ADD CONSTRAINT job_checklist_items_metadata_category_valid
      CHECK (
        metadata IS NULL
        OR NOT (metadata ? 'category')
        OR (metadata ->> 'category') IN ('standard', 'task', 'tool', 'material')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.job_checklist_items.metadata IS
  'Optional structured metadata for checklist presentation and behavior (ex: category=tool|material|task|standard).';;
