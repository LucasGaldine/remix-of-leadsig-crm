import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTeamMemberDisplayName } from "@/lib/teamMembers";
import { buildMockCrewAssigneeId } from "@/lib/crewIdentifiers";
import { isMissingRelationError } from "@/lib/supabaseErrors";
import { fetchAccountMembersWithDescriptionFallback } from "@/lib/accountMembers";

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  description?: string | null;
  invited_at?: string | null;
  is_mock_profile: boolean;
  mock_profile_id?: string | null;
  phone?: string | null;
}

export function useTeamMembers() {
  const { currentAccount } = useAuth();

  return useQuery({
    queryKey: ["team-members", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount?.id) return [];

      const members = await fetchAccountMembersWithDescriptionFallback(async (includeDescription) => {
        const columns = includeDescription
          ? "user_id, role, invited_at, description"
          : "user_id, role, invited_at";

        return supabase
          .from("account_members")
          .select(columns)
          .eq("account_id", currentAccount.id)
          .eq("is_active", true);
      });

      if (!members || members.length === 0) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const { data: mockProfiles, error: mockProfilesError } = await supabase
        .from("mock_crew_profiles")
        .select("id, full_name, phone, role, description")
        .eq("account_id", currentAccount.id)
        .order("full_name", { ascending: true });

      const mockProfilesTableMissing = isMissingRelationError(mockProfilesError, "mock_crew_profiles");

      if (mockProfilesError && !mockProfilesTableMissing) {
        throw mockProfilesError;
      }

      const profilesMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      const realMembers = members
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
            description: member.description || null,
            invited_at: member.invited_at,
            is_mock_profile: !profile?.full_name,
            mock_profile_id: null,
            phone: null,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name)) as TeamMember[];

      const mockMembers = (mockProfiles || []).map((mockProfile) => ({
        user_id: buildMockCrewAssigneeId(mockProfile.id),
        full_name: getTeamMemberDisplayName({
          user_id: buildMockCrewAssigneeId(mockProfile.id),
          role: mockProfile.role,
          mock_profile_name: mockProfile.full_name,
        }),
        email: "",
        role: mockProfile.role,
        description: mockProfile.description || null,
        invited_at: null,
        is_mock_profile: true,
        mock_profile_id: mockProfile.id,
        phone: mockProfile.phone || null,
      })) as TeamMember[];

      return [...realMembers, ...mockMembers].sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!currentAccount?.id,
  });
}
