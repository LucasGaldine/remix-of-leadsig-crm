import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, getUserMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { shouldRetryGoogleEmailConnectionStatus, startGoogleEmailConnect } from "@/hooks/useGoogleEmailConnection";

describe("startGoogleEmailConnect", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getUserMock.mockReset();
  });

  it("invokes the account-scoped Google email connect function", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user_123" } }, error: null });
    invokeMock.mockResolvedValue({ data: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth" }, error: null });

    await startGoogleEmailConnect("acct_1", "https://app.test");

    expect(invokeMock).toHaveBeenCalledWith("google-email-connect", {
      body: {
        accountId: "acct_1",
        appUrl: "https://app.test",
      },
    });
  });

  it("throws when no signed-in user exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(startGoogleEmailConnect("acct_1", "https://app.test")).rejects.toThrow(
      "You must be signed in to connect Google Email",
    );
  });
});

describe("shouldRetryGoogleEmailConnectionStatus", () => {
  it("does not retry status checks so missing deployed functions do not spam the console", () => {
    expect(shouldRetryGoogleEmailConnectionStatus()).toBe(false);
  });
});
