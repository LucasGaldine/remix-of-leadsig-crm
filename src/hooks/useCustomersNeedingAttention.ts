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

      // Fetch customers with unpaid invoices
      const { data: unpaidInvoices } = await supabase
        .from("invoices")
        .select("customer_id, customers(id, name, phone, address, city)")
        .eq("account_id", currentAccount.id)
        .in("status", ["sent", "viewed", "overdue", "partial"])
        .not("customer_id", "is", null);

      // Fetch customers with active/pending jobs (leads with status "job")
      const { data: pendingJobs } = await supabase
        .from("leads")
        .select("customer_id, customers(id, name, phone, address, city)")
        .eq("account_id", currentAccount.id)
        .eq("status", "job")
        .not("customer_id", "is", null);

      const customerMap = new Map<string, CustomerAttention>();

      // Process unpaid invoices
      (unpaidInvoices || []).forEach((inv: any) => {
        const c = inv.customers;
        if (!c?.id) return;
        if (!customerMap.has(c.id)) {
          customerMap.set(c.id, {
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            city: c.city,
            reason: "Unpaid invoice",
          });
        }
      });

      // Process pending jobs
      (pendingJobs || []).forEach((job: any) => {
        const c = job.customers;
        if (!c?.id) return;
        if (customerMap.has(c.id)) {
          const existing = customerMap.get(c.id)!;
          if (!existing.reason.includes("Pending job")) {
            existing.reason += " · Pending job";
          }
        } else {
          customerMap.set(c.id, {
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            city: c.city,
            reason: "Pending job",
          });
        }
      });

      return Array.from(customerMap.values());
    },
    enabled: !!user && !!currentAccount,
  });
}
