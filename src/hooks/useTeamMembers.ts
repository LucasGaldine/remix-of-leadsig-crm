import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

export function useTeamMembers() {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["team-members", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount?.id) return [];

      const { data, error } = await supabase
        .from("account_members_with_profiles")
        .select("user_id, full_name, email, role")
        .eq("account_id", currentAccount.id)
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!currentAccount?.id,
  });
}
