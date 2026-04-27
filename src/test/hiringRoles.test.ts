import { describe, expect, it } from "vitest";

import { isPublishedHiringRole } from "@/lib/hiringRoles";

describe("isPublishedHiringRole", () => {
  it("returns true for published and active statuses", () => {
    expect(isPublishedHiringRole({ id: "1", title: "Crew Lead", status: "published" })).toBe(true);
    expect(isPublishedHiringRole({ id: "2", title: "Crew Lead", status: "active" })).toBe(true);
    expect(isPublishedHiringRole({ id: "3", title: "Crew Lead", status: " Published " })).toBe(true);
  });

  it("returns false for draft and missing status", () => {
    expect(isPublishedHiringRole({ id: "1", title: "Crew Lead", status: "draft" })).toBe(false);
    expect(isPublishedHiringRole({ id: "2", title: "Crew Lead" })).toBe(false);
  });
});
