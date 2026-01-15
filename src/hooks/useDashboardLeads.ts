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

export function usePendingApprovalEstimates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-estimates", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select(`
          *,
          lead:leads(
            id,
            name,
            customer:customers(id, name)
          )
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
