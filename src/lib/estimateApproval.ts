import { supabase } from "@/integrations/supabase/client";

export async function approveEstimateManuallyById(estimateId: string) {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("estimates")
    .update({
      status: "accepted",
      approved_via: "manual",
      accepted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", estimateId);

  if (error) throw error;
}

export async function approveLatestEstimateForJob(jobId: string) {
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id")
    .eq("job_id", jobId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (estimateError) throw estimateError;
  if (!estimate?.id) throw new Error("No estimate found for this job");

  await approveEstimateManuallyById(estimate.id);
}
