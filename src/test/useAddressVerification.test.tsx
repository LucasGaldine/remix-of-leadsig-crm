import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { invokeMock, getSessionMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
    auth: {
      getSession: getSessionMock,
    },
  },
}));

import { useAddressVerification } from "@/hooks/useAddressVerification";

describe("useAddressVerification", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getSessionMock.mockReset();
  });

  it("includes Authorization header when verifying an address", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });

    invokeMock.mockResolvedValue({
      data: { verified: true, formatted: "123 MAIN ST, AUSTIN, TX 78701" },
      error: null,
    });

    const { result } = renderHook(() => useAddressVerification());

    await act(async () => {
      await result.current.verify("123 Main St, Austin, TX 78701");
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "verify-address",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );
  });

  it("does not send Authorization header when there is no session token", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
    });

    invokeMock.mockResolvedValue({
      data: { verified: true, formatted: "123 MAIN ST, AUSTIN, TX 78701" },
      error: null,
    });

    const { result } = renderHook(() => useAddressVerification());

    await act(async () => {
      await result.current.verify("123 Main St, Austin, TX 78701");
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "verify-address",
      expect.objectContaining({
        headers: undefined,
      }),
    );
  });
});
