import { isMockCrewAssigneeId } from "@/lib/crewIdentifiers";

export interface TeamMemberLike {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  invited_at?: string | null;
  mock_profile_name?: string | null;
}

export function getTeamMemberDisplayName(member: TeamMemberLike) {
  const trimmedName = member.full_name?.trim();
  if (trimmedName) return trimmedName;

  const trimmedMockName = member.mock_profile_name?.trim();
  if (trimmedMockName) return trimmedMockName;

  const trimmedEmail = member.email?.trim();
  if (trimmedEmail) {
    const [localPart] = trimmedEmail.split("@");
    return localPart || trimmedEmail;
  }

  if (member.role === "crew_member" || member.role === "crew_lead") {
    return "Unsigned crew member";
  }

  return "Team member";
}

export function countRealTeamMembers(members: Pick<TeamMemberLike, "user_id">[]) {
  return members.filter((member) => !isMockCrewAssigneeId(member.user_id)).length;
}

export function isSinglePersonCompany(members: Pick<TeamMemberLike, "user_id">[]) {
  return countRealTeamMembers(members) <= 1;
}
