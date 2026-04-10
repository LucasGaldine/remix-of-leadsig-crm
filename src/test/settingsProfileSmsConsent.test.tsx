import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsProfile from "@/pages/SettingsProfile";

const { updateMock, eqMock, refreshProfileMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  eqMock: vi.fn(),
  refreshProfileMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

const mockAuth = {
  user: { id: "user-1", email: "owner@leadsig.ai" },
  role: "owner",
  currentAccount: { company_name: "LeadSig" },
  refreshProfile: refreshProfileMock,
  profile: {
    full_name: "Taylor Smith",
    email: "owner@leadsig.ai",
    phone: "(555) 111-2222",
    timezone: "America/New_York",
    avatar_url: null,
    sms_consent_status: "unknown",
    notification_preferences: {
      channels: { sms: true, email: true, push: false },
    },
  },
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
  StickyActionBar: ({ onSave }: { onSave: () => void }) => (
    <button onClick={onSave}>Save Changes</button>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock,
    })),
    auth: {
      updateUser: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  },
}));

describe("SettingsProfile", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqMock.mockReset();
    refreshProfileMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockResolvedValue({ error: null });

    mockAuth.profile.sms_consent_status = "unknown";
    mockAuth.profile.notification_preferences = {
      channels: { sms: true, email: true, push: false },
    };
  });

  it("does not render SMS consent controls", () => {
    render(
      <MemoryRouter>
        <SettingsProfile />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/SMS Consent/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /I agree to receive SMS messages from LeadSig/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /I do not agree to receive SMS messages from LeadSig/i })).not.toBeInTheDocument();
  });

  it("saving profile does not update SMS consent fields", async () => {
    render(
      <MemoryRouter>
        <SettingsProfile />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Taylor Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Taylor Updated",
        }),
      );
    });

    const payload = updateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.sms_consent_status).toBeUndefined();
    expect(payload.sms_consent_source).toBeUndefined();
    expect(payload.sms_consent_text_version).toBeUndefined();
    expect(payload.sms_consent_captured_at).toBeUndefined();
    expect(payload.notification_preferences).toBeUndefined();
  });
});
