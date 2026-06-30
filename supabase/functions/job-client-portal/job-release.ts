import { uploadJobReleaseSignatureDataUrl } from "./signature.ts";

export async function isLeadFullyPaid(supabase: any, leadId: string): Promise<boolean> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status, balance_due")
    .eq("lead_id", leadId);

  const rows = invoices || [];
  if (rows.length === 0) return false;

  return rows.every((invoice: any) => invoice.status === "paid" && Number(invoice.balance_due || 0) <= 0);
}

export async function getJobReleaseForLead(supabase: any, leadId: string) {
  const { data } = await supabase
    .from("job_releases")
    .select("id, status, release_text, signed_at, signature_image_url, requested_at")
    .eq("lead_id", leadId)
    .maybeSingle();

  return data || null;
}

export async function signJobRelease(
  supabase: any,
  lead: { id: string; account_id: string; customer_id: string },
  signatureDataUrl: string | null,
  jsonResponse: (body: unknown, status?: number) => Response,
) {
  const fullyPaid = await isLeadFullyPaid(supabase, lead.id);
  if (!fullyPaid) {
    return jsonResponse({ error: "Job release can only be signed after all invoices are fully paid." }, 400);
  }

  const { data: jobRelease, error: releaseError } = await supabase
    .from("job_releases")
    .select("id, status")
    .eq("lead_id", lead.id)
    .maybeSingle();

  if (releaseError || !jobRelease) {
    return jsonResponse({ error: "Job release not found for this job." }, 404);
  }

  if (jobRelease.status === "signed") {
    return jsonResponse({ error: "Job release has already been signed." }, 400);
  }

  let signaturePublicUrl: string | null = null;
  if (signatureDataUrl) {
    const uploadResult = await uploadJobReleaseSignatureDataUrl(supabase, jobRelease.id, signatureDataUrl);
    if (!uploadResult.ok) {
      return jsonResponse({ error: uploadResult.error }, uploadResult.statusCode);
    }
    signaturePublicUrl = uploadResult.publicUrl;
  }

  const { error: updateError } = await supabase
    .from("job_releases")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signature_image_url: signaturePublicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobRelease.id)
    .eq("status", "pending_signature");

  if (updateError) {
    return jsonResponse({ error: "Failed to sign job release." }, 500);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    await fetch(`${supabaseUrl}/functions/v1/send-job-release-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}),
      },
      body: JSON.stringify({ job_release_id: jobRelease.id, event_type: "signed_copy" }),
    });
  } catch (error) {
    console.error("Failed to dispatch signed job release notifications:", error);
  }

  return jsonResponse({ success: true, message: "Job release signed." });
}
