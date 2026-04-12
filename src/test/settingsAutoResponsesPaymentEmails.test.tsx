import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsAutoResponses from "@/pages/SettingsAutoResponses";

const { updateSettingsAsyncMock } = vi.hoisted(() => ({
  updateSettingsAsyncMock: vi.fn(),
}));

let mockSettings: Record<string, unknown> | null;

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

vi.mock("@/components/features/PlanGate", () => ({
  PlanGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useAccountSettings", () => ({
  useAccountSettings: () => ({
    settings: mockSettings,
    updateSettingsAsync: updateSettingsAsyncMock,
    isSaving: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SettingsAutoResponses payment emails", () => {
  beforeEach(() => {
    mockSettings = {};
    updateSettingsAsyncMock.mockReset();
    updateSettingsAsyncMock.mockResolvedValue({});
  });

  it("defaults payment email toggles to enabled", () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByRole("switch", { name: /send payment email when estimate is approved/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /send payment email when invoice is sent/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /send payment email when payment is logged/i })).toHaveAttribute("aria-checked", "true");
  });

  it("hydrates payment email toggles from account settings", () => {
    mockSettings = {
      job_message_automation: {
        payment_emails: {
          estimate_approved: false,
          invoice_sent: true,
          payment_logged: false,
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByRole("switch", { name: /send payment email when estimate is approved/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /send payment email when invoice is sent/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /send payment email when payment is logged/i })).toHaveAttribute("aria-checked", "false");
  });

  it("saves payment email preferences into job message automation settings", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /send payment email when estimate is approved/i }));
    fireEvent.click(screen.getByRole("switch", { name: /send payment email when payment is logged/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      job_message_automation?: {
        payment_emails?: Record<string, boolean>;
      };
    };

    expect(payload.job_message_automation?.payment_emails).toEqual({
      estimate_approved: false,
      invoice_sent: true,
      payment_logged: false,
    });
  });
});
