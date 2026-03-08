/*
  # Fix create_user_notifications function overload ambiguity

  1. Problem
    - The previous migration created an 8-parameter version of `create_user_notifications`
      while the old 7-parameter version still existed, causing ambiguous function calls
    - This caused lead creation to fail with a 400 error

  2. Fix
    - Drop the old 7-parameter function signature
    - Keep only the 8-parameter version with `p_lead_id uuid DEFAULT NULL`
    - All existing callers with 7 args will resolve to the DEFAULT NULL version
*/

DROP FUNCTION IF EXISTS create_user_notifications(uuid, text, text, text, text, uuid, text);