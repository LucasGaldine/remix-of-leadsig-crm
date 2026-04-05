export const MOCK_CREW_ID_PREFIX = "mock:";

export function buildMockCrewAssigneeId(mockProfileId: string) {
  return `${MOCK_CREW_ID_PREFIX}${mockProfileId}`;
}

export function isMockCrewAssigneeId(assigneeId: string) {
  return assigneeId.startsWith(MOCK_CREW_ID_PREFIX);
}

export function parseCrewAssigneeId(assigneeId: string) {
  if (isMockCrewAssigneeId(assigneeId)) {
    return {
      type: "mock" as const,
      mockProfileId: assigneeId.slice(MOCK_CREW_ID_PREFIX.length),
      userId: null,
    };
  }

  return {
    type: "user" as const,
    mockProfileId: null,
    userId: assigneeId,
  };
}

