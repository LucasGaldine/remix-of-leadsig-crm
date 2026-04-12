import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsNotifications from "@/pages/SettingsNotifications";

const {
  updateMock,
  eqMock,
  selectMock,
  maybeSingleMock,
  toastSuccessMock,
  toastErrorMock,
  refreshProfileMock,
} = vi.hoisted(() => ({
  updateMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  refreshProfileMock: vi.fn(),
}));

const mockAuth = {
  profile: {
    phone: "(555) 111-2222",
    email: "owner@leadsig.ai",
    sms_consent_status: "unknown",
    mention_notifications_enabled: true,
    notification_preferences: {
      channels: { push: false, email: false, sms: false },
      alerts: { new_leads: true, lead_updates: true, payments: true, schedule_changes: true, tasks: false },
      quiet_hours: { enabled: false, start: "21:00", end: "07:00" },
      digest: { frequency: "daily" },
    },
  },
  user: { id: "user-1", email: "owner@leadsig.ai" },
  currentAccount: { id: "acct_1" },
  isCrewMember: () => false,
  refreshProfile: refreshProfileMock,
};

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/settings/UnsavedChangesDialog", () => ({
  UnsavedChangesDialog: () => null,
}));

vi.mock("@/hooks/useUnsavedChanges", () => ({
  useUnsavedChanges: () => null,
}));

vi.mock("@/components/settings/StickyActionBar", () => ({
  StickyActionBar: ({ onSave, label }: { onSave: () => void; label?: string }) => (
    <button onClick={onSave}>{label || "Save"}</button>
  ),
}));

vi.mock("@/components/features/PlanGate", () => ({
  PlanGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/hooks/useSmsLogs", () => ({
  useSmsLogs: () => ({
    logs: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock,
      insert: vi.fn(),
    })),
  },
}));

describe("SettingsNotifications SMS consent save fallback", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    maybeSingleMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    refreshProfileMock.mockReset();

    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  });

  it("retries save without consent metadata columns when schema is missing them", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the 'sms_consent_captured_at' column of 'profiles' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: {
          notification_preferences: mockAuth.profile.notification_preferences,
          mention_notifications_enabled: true,
          sms_consent_status: "opted_in",
        },
        error: null,
      });

    render(
      <MemoryRouter>
        <SettingsNotifications />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to receive SMS messages from LeadSig/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save preferences/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(2);
    });

    const firstPayload = updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const secondPayload = updateMock.mock.calls[1]?.[0] as Record<string, unknown>;

    expect(firstPayload.sms_consent_captured_at).toBeDefined();
    expect(firstPayload.sms_consent_source).toBe("profile_settings");
    expect(firstPayload.sms_consent_text_version).toBeDefined();

    expect(secondPayload.sms_consent_status).toBe("opted_in");
    expect(secondPayload.sms_consent_captured_at).toBeUndefined();
    expect(secondPayload.sms_consent_source).toBeUndefined();
    expect(secondPayload.sms_consent_text_version).toBeUndefined();

    expect(toastSuccessMock).toHaveBeenCalledWith("Notification preferences saved");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
