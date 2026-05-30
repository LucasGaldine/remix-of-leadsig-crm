/*
  # Re-grant authenticated execute for job assignment overlap helpers

  Ensures authenticated users can execute overlap helpers used by
  job_assignments RLS policies.
*/

GRANT EXECUTE ON FUNCTION public.check_assignment_overlap(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_mock_assignment_overlap(uuid, uuid, uuid) TO authenticated;
