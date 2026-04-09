import { describe, expect, it, vi } from "vitest";

import {
  fetchAccountMembersWithDescriptionFallback,
  updateAccountMemberWithDescriptionFallback,
} from "@/lib/accountMembers";

describe("fetchAccountMembersWithDescriptionFallback", () => {
  it("retries without description when the column is missing", async () => {
    const fetchMembers = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42703",
          message: 'column "description" does not exist',
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "member_1",
            user_id: "user_1",
            role: "crew_member",
            joined_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        error: null,
      });

    const result = await fetchAccountMembersWithDescriptionFallback(fetchMembers);

    expect(fetchMembers).toHaveBeenNthCalledWith(1, true);
    expect(fetchMembers).toHaveBeenNthCalledWith(2, false);
    expect(result).toEqual([
      {
        id: "member_1",
        user_id: "user_1",
        role: "crew_member",
        joined_at: "2026-01-01T00:00:00.000Z",
        invited_at: null,
        description: null,
      },
    ]);
  });

  it("does not retry for non-missing-column errors", async () => {
    const fetchMembers = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "new row violates row-level security policy",
      },
    });

    await expect(fetchAccountMembersWithDescriptionFallback(fetchMembers)).rejects.toMatchObject({
      code: "42501",
    });

    expect(fetchMembers).toHaveBeenCalledTimes(1);
    expect(fetchMembers).toHaveBeenCalledWith(true);
  });
});

describe("updateAccountMemberWithDescriptionFallback", () => {
  it("retries without description when the column is missing", async () => {
    const updateMember = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          code: "42703",
          message: 'column "description" does not exist',
        },
      })
      .mockResolvedValueOnce({
        error: null,
      });

    await updateAccountMemberWithDescriptionFallback(updateMember, {
      role: "crew_lead",
      description: "Leads installs",
    });

    expect(updateMember).toHaveBeenNthCalledWith(1, {
      role: "crew_lead",
      description: "Leads installs",
    });
    expect(updateMember).toHaveBeenNthCalledWith(2, {
      role: "crew_lead",
    });
  });

  it("shows a clear message when only description is sent and the column is missing", async () => {
    const updateMember = vi.fn().mockResolvedValue({
      error: {
        code: "42703",
        message: 'column "description" does not exist',
      },
    });

    await expect(
      updateAccountMemberWithDescriptionFallback(updateMember, {
        description: "Can run jobs solo",
      }),
    ).rejects.toThrow("Crew member descriptions are unavailable until the latest database migration is applied.");
  });
});
