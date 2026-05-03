import { supabase } from "@/integrations/supabase/client";

export async function getNextInvoiceNumberSecure(accountId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke("secure-invoice-number", {
    body: { account_id: accountId },
  });

  if (error) throw error;

  const value = Number((data as { invoice_number?: unknown } | null)?.invoice_number ?? 1);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

export async function checkAssignmentOverlapSecure(args: {
  accountId: string;
  scheduleId: string;
  userId?: string | null;
  mockProfileId?: string | null;
}): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("secure-assignment-overlap", {
    body: {
      account_id: args.accountId,
      schedule_id: args.scheduleId,
      user_id: args.userId ?? null,
      mock_profile_id: args.mockProfileId ?? null,
    },
  });

  if (error) throw error;
  return Boolean((data as { has_overlap?: unknown } | null)?.has_overlap);
}
