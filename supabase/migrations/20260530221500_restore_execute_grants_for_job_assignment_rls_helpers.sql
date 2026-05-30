/*
  # Restore execute grants for job assignment RLS helper functions

  Fixes 42501 errors like:
  "permission denied for function is_user_account_manager"
  when inserting into public.job_assignments as authenticated users.
*/

GRANT EXECUTE ON FUNCTION public.is_user_account_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lead_in_account(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_schedule_in_account(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_in_account(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mock_profile_in_account(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_assignment_overlap(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_mock_assignment_overlap(uuid, uuid, uuid) TO authenticated;
