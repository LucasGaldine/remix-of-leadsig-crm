import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function useQualifiedLeads() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-leads", "qualified"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("approval_status", "approved")
        .eq("status", "qualified")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user,
  });
}

export function useInProgressLeads() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-leads", "in_progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("approval_status", "approved")
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user,
  });
}

export function useActiveJobs() {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: ["dashboard-leads", "active-jobs", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone, address),
          crew_lead:profiles!leads_crew_lead_id_fkey(id, full_name)
        `)
        .eq("approval_status", "approved")
        .in("status", ["scheduled", "in_progress"])
        .eq("scheduled_date", today)
        .order("scheduled_time_start", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function usePendingApprovalEstimates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-estimates", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select(`
          *,
          customer:customers(id, name)
        `)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
