/*
  # Allow account members to edit their own crew description

  ## Why
  Non-admin users can access Crew Management but were blocked by RLS from updating
  their own `account_members.description`.

  ## What
  Add a SECURITY DEFINER RPC that only updates the caller's own membership row,
  and only the `description` field.
*/

CREATE OR REPLACE FUNCTION public.update_own_account_member_description(
  member_id_param uuid,
  description_param text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.account_members
  SET description = description_param
  WHERE id = member_id_param
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to update description for this member';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_account_member_description(uuid, text) TO authenticated;
