import { supabase } from "@/integrations/supabase/client";

export interface ReleaseUpdate {
  id: string;
  account_id: string;
  title: string;
  description: string;
  highlights: string[];
  version: string;
  released_at: string;
  cta_label: string | null;
  cta_href: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export function selectLatestUnseenReleaseUpdate(
  updates: ReleaseUpdate[],
  seenReleaseUpdateIds: Set<string>
): ReleaseUpdate | null {
  for (const update of updates) {
    if (!seenReleaseUpdateIds.has(update.id)) {
      return update;
    }
  }
  return null;
}

export function getReleaseUpdateActionLabel(update: ReleaseUpdate): string {
  return update.cta_label?.trim() || "Mark as Read";
}

export async function getLatestUnseenReleaseUpdate(
  accountId: string,
  userId: string
): Promise<ReleaseUpdate | null> {
  const { data: updates, error: updatesError } = await supabase
    .from("release_updates")
    .select(
      "id, account_id, title, description, highlights, version, released_at, cta_label, cta_href, is_published, created_at, updated_at, created_by"
    )
    .eq("account_id", accountId)
    .eq("is_published", true)
    .order("released_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (updatesError) throw updatesError;
  if (!updates?.length) return null;

  const releaseUpdateIds = updates.map((update) => update.id);

  const { data: reads, error: readsError } = await supabase
    .from("release_update_reads")
    .select("release_update_id")
    .eq("user_id", userId)
    .in("release_update_id", releaseUpdateIds);

  if (readsError) throw readsError;

  const seenIds = new Set((reads ?? []).map((read) => read.release_update_id));
  return selectLatestUnseenReleaseUpdate(updates as ReleaseUpdate[], seenIds);
}

export async function markReleaseUpdateSeen(releaseUpdateId: string, accountId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("release_update_reads").upsert(
    {
      release_update_id: releaseUpdateId,
      account_id: accountId,
      user_id: userId,
    },
    { onConflict: "release_update_id,user_id" }
  );

  if (error) throw error;
}
