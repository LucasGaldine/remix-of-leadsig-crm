import { describe, it, expect, vi, beforeEach } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));
const { getUserMock } = vi.hoisted(() => ({
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

import {
  syncScheduleToCalendar,
  deleteScheduleFromCalendar,
  normalizeCalendarSyncAllResult,
  getLocalDateISO,
  startGoogleCalendarConnect,
} from "@/hooks/useGoogleCalendar";

describe("google calendar background sync helpers", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getUserMock.mockReset();
    vi.restoreAllMocks();
  });

  it("logs when upsert sync returns an edge-function error", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("calendar failed") });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await syncScheduleToCalendar("sched_1");

    expect(invokeMock).toHaveBeenCalledWith("sync-job-to-calendar", {
      body: { action: "upsert", scheduleId: "sched_1" },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "syncScheduleToCalendar failed:",
      "calendar failed"
    );
  });

  it("logs when delete sync returns an edge-function error", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("delete failed") });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await deleteScheduleFromCalendar("event_1", "acct_1");

    expect(invokeMock).toHaveBeenCalledWith("sync-job-to-calendar", {
      body: { action: "delete", googleEventId: "event_1", accountId: "acct_1" },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "deleteScheduleFromCalendar failed:",
      "delete failed"
    );
  });
});

describe("normalizeCalendarSyncAllResult", () => {
  it("fills missing total as zero", () => {
    expect(normalizeCalendarSyncAllResult({ synced: 0 })).toEqual({ synced: 0, total: 0, failed: 0, firstError: null });
  });

  it("keeps numeric synced and total", () => {
    expect(normalizeCalendarSyncAllResult({ synced: 3, total: 9 })).toEqual({ synced: 3, total: 9, failed: 0, firstError: null });
  });

  it("includes failure diagnostics", () => {
    expect(normalizeCalendarSyncAllResult({ synced: 0, total: 4, failed: 4, first_error: "Calendar not found" })).toEqual({
      synced: 0,
      total: 4,
      failed: 4,
      firstError: "Calendar not found",
    });
  });
});

describe("getLocalDateISO", () => {
  it("formats local calendar date as yyyy-mm-dd", () => {
    const date = new Date(2026, 3, 20, 23, 15, 0);
    expect(getLocalDateISO(date)).toBe("2026-04-20");
  });
});

describe("startGoogleCalendarConnect", () => {
  it("invokes connect function when user is authenticated", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user_123" } },
      error: null,
    });
    invokeMock.mockResolvedValue({ data: { authUrl: "https://example.com/auth" }, error: null });

    await startGoogleCalendarConnect("acct_1", "https://app.test");

    expect(invokeMock).toHaveBeenCalledWith("google-calendar-connect", {
      body: {
        accountId: "acct_1",
        appUrl: "https://app.test",
      },
    });
  });

  it("throws when no active session exists", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(startGoogleCalendarConnect("acct_1", "https://app.test")).rejects.toThrow(
      "You must be signed in to connect Google Calendar"
    );
  });
});
