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
