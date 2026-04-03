import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTeamMemberDisplayName } from "@/lib/teamMembers";

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  invited_at?: string | null;
  is_mock_profile: boolean;
}

export function useTeamMembers() {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["team-members", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount?.id) return [];

      const { data: members, error: membersError } = await supabase
        .from("account_members")
        .select("user_id, role, invited_at")
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
        .map(member => {
          const profile = profilesMap.get(member.user_id);
          return {
            user_id: member.user_id,
            full_name: getTeamMemberDisplayName({
              user_id: member.user_id,
              full_name: profile?.full_name,
              email: profile?.email,
              role: member.role,
              invited_at: member.invited_at,
            }),
            email: profile?.email || "",
            role: member.role,
            invited_at: member.invited_at,
            is_mock_profile: !profile?.full_name,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name)) as TeamMember[];
    },
    enabled: !!currentAccount?.id,
  });
}
