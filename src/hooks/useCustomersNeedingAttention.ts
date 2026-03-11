import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CustomerAttention {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  reason: string;
}

export function useCustomersNeedingAttention() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["customers-needing-attention", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const customerMap = new Map<string, CustomerAttention>();

      // Fetch customers with unpaid invoices
      const { data: unpaidInvoices, error: invoiceError } = await supabase
        .from("invoices")
        .select("customer_id, customers!inner(id, name, phone, address, city)")
        .eq("account_id", currentAccount.id)
        .in("status", ["sent", "viewed", "overdue", "partial"])
        .not("customer_id", "is", null);

      if (!invoiceError && unpaidInvoices) {
        unpaidInvoices.forEach((inv: any) => {
          const c = inv.customers;
          if (!c?.id) return;
          if (!customerMap.has(c.id)) {
            customerMap.set(c.id, {
              id: c.id,
              name: c.name || "Unknown",
              phone: c.phone,
              address: c.address,
              city: c.city,
              reason: "Unpaid invoice",
            });
          }
        });
      }

      // Fetch customers with active jobs (leads with status "scheduled")
      const { data: activeJobs, error: jobError } = await supabase
        .from("leads")
        .select("customer_id, customers!inner(id, name, phone, address, city)")
        .eq("account_id", currentAccount.id)
        .in("status", ["scheduled", "won"])
        .not("customer_id", "is", null);

      if (!jobError && activeJobs) {
        activeJobs.forEach((job: any) => {
          const c = job.customers;
          if (!c?.id) return;
          if (customerMap.has(c.id)) {
            const existing = customerMap.get(c.id)!;
            if (!existing.reason.includes("Active job")) {
              existing.reason += " · Active job";
            }
          } else {
            customerMap.set(c.id, {
              id: c.id,
              name: c.name || "Unknown",
              phone: c.phone,
              address: c.address,
              city: c.city,
              reason: "Active job",
            });
          }
        });
      }

      return Array.from(customerMap.values());
    },
    enabled: !!user && !!currentAccount,
  });
}
