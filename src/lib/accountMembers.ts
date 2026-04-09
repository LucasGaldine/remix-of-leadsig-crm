import { isMissingColumnError } from "@/lib/supabaseErrors";

export interface AccountMemberRow {
  id?: string;
  user_id: string;
  role: string;
  joined_at?: string;
  invited_at?: string | null;
  description: string | null;
}

interface FetchResult {
  data: Array<Record<string, unknown>> | null;
  error: unknown;
}

interface UpdateResult {
  error: unknown;
}

type FetchMembersFn = (includeDescription: boolean) => Promise<FetchResult>;
type UpdateMemberFn = (updates: { role?: string; description?: string | null }) => Promise<UpdateResult>;

export async function fetchAccountMembersWithDescriptionFallback(fetchMembers: FetchMembersFn): Promise<AccountMemberRow[]> {
  let response = await fetchMembers(true);

  if (response.error && isMissingColumnError(response.error as { code?: string; message?: string }, "description")) {
    response = await fetchMembers(false);
  }

  if (response.error) {
    throw response.error;
  }

  return (response.data || []).map((member) => ({
    id: typeof member.id === "string" ? member.id : undefined,
    user_id: String(member.user_id || ""),
    role: String(member.role || ""),
    joined_at: typeof member.joined_at === "string" ? member.joined_at : undefined,
    invited_at: typeof member.invited_at === "string" ? member.invited_at : null,
    description: typeof member.description === "string" ? member.description : null,
  }));
}

export async function updateAccountMemberWithDescriptionFallback(
  updateMember: UpdateMemberFn,
  updates: { role?: string; description?: string | null },
): Promise<void> {
  let response = await updateMember(updates);

  if (
    response.error &&
    updates.description !== undefined &&
    isMissingColumnError(response.error as { code?: string; message?: string }, "description")
  ) {
    const fallbackUpdates: { role?: string } = {};
    if (updates.role !== undefined) {
      fallbackUpdates.role = updates.role;
    }

    if (Object.keys(fallbackUpdates).length === 0) {
      throw new Error("Crew member descriptions are unavailable until the latest database migration is applied.");
    }

    response = await updateMember(fallbackUpdates);
  }

  if (response.error) {
    throw response.error;
  }
}
