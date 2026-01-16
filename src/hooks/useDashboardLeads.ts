import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function useQualifiedLeads() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-leads", "qualified", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("account_id", currentAccount.id)
        .eq("approval_status", "approved")
        .eq("status", "qualified")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useActiveJobs() {
  const { user, currentAccount } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: ["dashboard-leads", "active-jobs", today, currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name)
        `)
        .eq("account_id", currentAccount.id)
        .eq("approval_status", "approved")
        .in("status", ["scheduled", "in_progress"])
        .eq("scheduled_date", today)
        .order("scheduled_time_start", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentAccount,
  });
}

export function usePendingApprovalEstimates() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["dashboard-estimates", "pending", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("estimates")
        .select(`
          *,
          customer:customers(id, name)
        `)
        .eq("account_id", currentAccount.id)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentAccount,
  });
}
