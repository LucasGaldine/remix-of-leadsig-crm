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

      const { data: members, error: membersError } = await supabase
        .from("account_members")
        .select("user_id, role")
        .eq("account_id", currentAccount.id)
        .eq("is_active", true);

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      return members
        .map(member => ({
          user_id: member.user_id,
          full_name: profilesMap.get(member.user_id)?.full_name || "",
          email: profilesMap.get(member.user_id)?.email || "",
          role: member.role,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)) as TeamMember[];
    },
    enabled: !!currentAccount?.id,
  });
}
