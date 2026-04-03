import { describe, expect, it } from "vitest";

import { getTeamMemberDisplayName } from "@/lib/teamMembers";

describe("getTeamMemberDisplayName", () => {
  it("prefers the real full name when present", () => {
    expect(
      getTeamMemberDisplayName({
        user_id: "user_1",
        full_name: "Avery Stone",
        email: "avery@example.com",
        role: "crew_member",
      }),
    ).toBe("Avery Stone");
  });

  it("falls back to email local part for invited members without a profile", () => {
    expect(
      getTeamMemberDisplayName({
        user_id: "user_2",
        full_name: null,
        email: "crew.test@example.com",
        role: "crew_member",
      }),
    ).toBe("crew.test");
  });

  it("uses unsigned crew placeholder when neither name nor email exists", () => {
    expect(
      getTeamMemberDisplayName({
        user_id: "user_3",
        full_name: null,
        email: null,
        role: "crew_member",
      }),
    ).toBe("Unsigned crew member");
  });
});
