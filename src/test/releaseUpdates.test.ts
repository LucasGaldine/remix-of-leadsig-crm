import { describe, expect, it } from "vitest";

import {
  getReleaseUpdateActionLabel,
  selectLatestUnseenReleaseUpdate,
  type ReleaseUpdate,
} from "@/lib/releaseUpdates";

const updates: ReleaseUpdate[] = [
  {
    id: "a",
    account_id: "acct-1",
    title: "A",
    description: "A desc",
    highlights: ["a1"],
    version: "1.0.0",
    released_at: "2026-04-01",
    cta_label: null,
    cta_href: null,
    is_published: true,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    created_by: "u1",
  },
  {
    id: "b",
    account_id: "acct-1",
    title: "B",
    description: "B desc",
    highlights: ["b1"],
    version: "1.1.0",
    released_at: "2026-04-15",
    cta_label: "Open",
    cta_href: "/tutorial",
    is_published: true,
    created_at: "2026-04-15T00:00:00Z",
    updated_at: "2026-04-15T00:00:00Z",
    created_by: "u1",
  },
];

describe("releaseUpdates", () => {
  it("selects the latest unseen published update", () => {
    const unseen = selectLatestUnseenReleaseUpdate(updates, new Set(["a"]));
    expect(unseen?.id).toBe("b");
  });

  it("returns null when all updates are seen", () => {
    const unseen = selectLatestUnseenReleaseUpdate(updates, new Set(["a", "b"]));
    expect(unseen).toBeNull();
  });

  it("defaults action label to Mark as Read", () => {
    expect(getReleaseUpdateActionLabel(updates[0])).toBe("Mark as Read");
  });

  it("uses custom action label when provided", () => {
    expect(getReleaseUpdateActionLabel(updates[1])).toBe("Open");
  });
});
