import { describe, expect, it } from "vitest";

import {
  buildMockCrewAssigneeId,
  isMockCrewAssigneeId,
  parseCrewAssigneeId,
} from "@/lib/crewIdentifiers";

describe("crewIdentifiers", () => {
  it("builds mock assignee ids with a stable prefix", () => {
    expect(buildMockCrewAssigneeId("abc-123")).toBe("mock:abc-123");
  });

  it("parses a real user assignee id", () => {
    expect(parseCrewAssigneeId("user-1")).toEqual({
      type: "user",
      userId: "user-1",
      mockProfileId: null,
    });
  });

  it("parses a mock assignee id", () => {
    const mockId = buildMockCrewAssigneeId("mock-9");
    expect(isMockCrewAssigneeId(mockId)).toBe(true);
    expect(parseCrewAssigneeId(mockId)).toEqual({
      type: "mock",
      userId: null,
      mockProfileId: "mock-9",
    });
  });
});

