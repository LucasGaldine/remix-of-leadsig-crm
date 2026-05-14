import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsAutoResponses from "@/pages/SettingsAutoResponses";

const {
  updateSettingsAsyncMock,
  toastErrorMock,
  toastSuccessMock,
  invokeFunctionMock,
  connectGoogleEmailMock,
  disconnectGoogleEmailMock,
} = vi.hoisted(() => ({
  updateSettingsAsyncMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  invokeFunctionMock: vi.fn(),
  connectGoogleEmailMock: vi.fn(),
  disconnectGoogleEmailMock: vi.fn(),
}));

let mockSettings: Record<string, unknown> | null;
let mockPricingPlan: "free" | "basic" | "premium";
let mockGoogleEmailConnection: {
  isConnected: boolean;
  connectedEmail: string | null;
  isLoading: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
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

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: {
      id: "acct_1",
      pricing_plan: mockPricingPlan,
    },
  }),
}));

vi.mock("@/hooks/useGoogleEmailConnection", () => ({
  useGoogleEmailConnection: () => ({
    ...mockGoogleEmailConnection,
    connect: connectGoogleEmailMock,
    disconnect: disconnectGoogleEmailMock,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeFunctionMock,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("SettingsAutoResponses payment emails", () => {
  beforeEach(() => {
    mockSettings = {};
    mockPricingPlan = "premium";
    mockGoogleEmailConnection = {
      isConnected: false,
      connectedEmail: null,
      isLoading: false,
      isConnecting: false,
      isDisconnecting: false,
    };
    updateSettingsAsyncMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    invokeFunctionMock.mockReset();
    connectGoogleEmailMock.mockReset();
    disconnectGoogleEmailMock.mockReset();
    updateSettingsAsyncMock.mockResolvedValue({});
    invokeFunctionMock.mockResolvedValue({ data: { success: true }, error: null });
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
    expect(screen.getByRole("switch", { name: /send job release request email when job is fully paid/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /send signed job release copy email after signature/i })).toHaveAttribute("aria-checked", "true");
  });

  it("hydrates payment email toggles from account settings", () => {
    mockSettings = {
      job_message_automation: {
        payment_emails: {
          estimate_approved: false,
          invoice_sent: true,
          payment_logged: false,
          job_release_request_email: false,
          job_release_signed_copy_email: true,
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
    expect(screen.getByRole("switch", { name: /send job release request email when job is fully paid/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /send signed job release copy email after signature/i })).toHaveAttribute("aria-checked", "true");
  });

  it("hydrates lead message automation toggle from account settings", () => {
    mockSettings = {
      lead_message_automation: {
        enabled: true,
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByRole("switch", { name: /enable lead message automation/i })).toHaveAttribute("aria-checked", "true");
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
      job_release_request_email: true,
      job_release_signed_copy_email: true,
    });
  });

  it("saves lead message automation toggle state", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /enable lead message automation/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      lead_message_automation?: {
        enabled?: boolean;
      };
    };

    expect(payload.lead_message_automation?.enabled).toBe(true);
  });

  it("forces payment email preferences off for free plan accounts", async () => {
    mockPricingPlan = "free";
    mockSettings = {
      job_message_automation: {
        payment_emails: {
          estimate_approved: true,
          invoice_sent: true,
          payment_logged: true,
          job_release_request_email: true,
          job_release_signed_copy_email: true,
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      job_message_automation?: {
        enabled?: boolean;
        payment_emails?: Record<string, boolean>;
      };
    };

    expect(payload.job_message_automation?.enabled).toBe(false);
    expect(payload.job_message_automation?.payment_emails).toEqual({
      estimate_approved: false,
      invoice_sent: false,
      payment_logged: false,
      job_release_request_email: false,
      job_release_signed_copy_email: false,
    });
  });

  it("hydrates connected Twilio fields from automation settings", () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_templates: [
          {
            id: "template-1",
            name: "Template 1",
            content: "Hello",
            is_finished: true,
            delivery_channel: "text",
            job_service_types: [],
            trigger: { type: "immediate", offset_value: 0, offset_unit: "days" },
          },
        ],
        twilio: {
          account_sid: "AC1234567890abcdef1234567890abcd",
          auth_token: "twilio_auth_token",
          from_number: "+15550001111",
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /use default number/i }));
    fireEvent.click(screen.getByRole("button", { name: /or use outside number/i }));
    expect(screen.getByLabelText(/twilio account sid/i)).toHaveValue("AC1234567890abcdef1234567890abcd");
    expect(screen.getByLabelText(/twilio auth token/i)).toHaveValue("twilio_auth_token");
    expect(screen.getByLabelText(/connected twilio sender number/i)).toHaveValue("+15550001111");
  });

  it("keeps job message automation enabled when Twilio is not connected", async () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_templates: [
          {
            id: "template-1",
            name: "Template 1",
            content: "Hello",
            is_finished: true,
            delivery_channel: "text",
            job_service_types: [],
            trigger: { type: "immediate", offset_value: 0, offset_unit: "days" },
          },
        ],
        twilio: {
          from_number: "",
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      job_message_automation?: { enabled?: boolean };
    };

    expect(payload.job_message_automation?.enabled).toBe(true);
  });

  it("saves connected twilio credentials into job message automation settings", async () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_templates: [
          {
            id: "template-1",
            name: "Template 1",
            content: "Hello",
            is_finished: true,
            delivery_channel: "text",
            job_service_types: [],
            trigger: { type: "immediate", offset_value: 0, offset_unit: "days" },
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /use default number/i }));
    fireEvent.click(screen.getByRole("button", { name: /or use outside number/i }));
    fireEvent.change(screen.getByLabelText(/twilio account sid/i), { target: { value: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } });
    fireEvent.change(screen.getByLabelText(/twilio auth token/i), { target: { value: "twilio_secret_token" } });
    fireEvent.change(screen.getByLabelText(/connected twilio sender number/i), { target: { value: "+15554443333" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      job_message_automation?: {
        twilio?: { account_sid?: string; auth_token?: string; from_number?: string };
      };
    };

    expect(payload.job_message_automation?.twilio).toEqual({
      account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      auth_token: "twilio_secret_token",
      from_number: "+15554443333",
    });
  });

  it("shows coming soon when Get number is clicked", () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /use default number/i }));
    fireEvent.click(screen.getByRole("button", { name: /get number/i }));

    expect(toastSuccessMock).toHaveBeenCalledWith("Coming soon");
  });

  it("shows the account Google Email connection and starts connect", () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByText(/company email sender/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /connect google email/i }));

    expect(connectGoogleEmailMock).toHaveBeenCalled();
  });

  it("shows connected Google Email and allows disconnect", () => {
    mockGoogleEmailConnection = {
      isConnected: true,
      connectedEmail: "sender@example.com",
      isLoading: false,
      isConnecting: false,
      isDisconnecting: false,
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByText("sender@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /disconnect google email/i }));

    expect(disconnectGoogleEmailMock).toHaveBeenCalled();
  });

  it("opens a send-test-message modal and sends to the entered phone number", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /send test message/i }));
    fireEvent.change(screen.getByLabelText(/destination phone number/i), { target: { value: "(555) 222-3344" } });
    fireEvent.click(screen.getByRole("button", { name: /^send message$/i }));

    await waitFor(() => {
      expect(invokeFunctionMock).toHaveBeenCalledWith("send-job-automation-test-message", {
        body: {
          account_id: "acct_1",
          to: "+15552223344",
        },
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Test message sent to +15552223344");
  });

  it("opens a lead test modal and sends to the entered phone number", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /enable lead message automation/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /send lead test/i }));
    fireEvent.change(screen.getByLabelText(/lead test destination phone number/i), { target: { value: "(555) 333-7788" } });
    const leadTestDialog = screen.getByRole("dialog");
    fireEvent.click(within(leadTestDialog).getByRole("button", { name: /send lead test/i }));

    await waitFor(() => {
      expect(invokeFunctionMock).toHaveBeenCalledWith("send-lead-automation-test-message", {
        body: {
          account_id: "acct_1",
          to: "+15553337788",
        },
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Lead automation test sent to +15553337788");
  });

  it("requires a valid destination phone number before sending a test message", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /send test message/i }));
    fireEvent.click(screen.getByRole("button", { name: /^send message$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Enter a valid phone number to send the test message.");
    });
    expect(invokeFunctionMock).not.toHaveBeenCalled();
  });

  it("creates a new message when Add message is clicked after editing an existing template", () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_templates: [
          {
            id: "template-1",
            name: "Existing Template",
            content: "Existing content",
            is_finished: true,
            delivery_channel: "text",
            job_service_types: [],
            trigger: { type: "immediate", offset_value: 0, offset_unit: "days" },
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Existing Template"));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add message$/i }));
    fireEvent.change(screen.getByPlaceholderText(/reminder: \{\{job_name\}\} is scheduled/i), { target: { value: "New content" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm template/i }));

    expect(screen.getByText("Existing Template")).toBeInTheDocument();
    expect(screen.getByText("Existing content")).toBeInTheDocument();
    expect(screen.getByText("New content")).toBeInTheDocument();
  });
});
