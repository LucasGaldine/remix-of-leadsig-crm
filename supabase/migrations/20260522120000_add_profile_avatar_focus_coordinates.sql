/*
  # Add profile avatar focus coordinates

  Adds persisted focus coordinates used by avatar rendering so users can choose
  the visible focal point in circular crops.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_focus_x'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN avatar_focus_x integer NOT NULL DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_focus_y'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN avatar_focus_y integer NOT NULL DEFAULT 50;
  END IF;
END $$;

UPDATE public.profiles
SET
  avatar_focus_x = COALESCE(avatar_focus_x, 50),
  avatar_focus_y = COALESCE(avatar_focus_y, 50)
WHERE avatar_focus_x IS NULL OR avatar_focus_y IS NULL;
