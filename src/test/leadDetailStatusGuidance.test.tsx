import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import LeadDetail from "@/pages/LeadDetail";
import { TooltipProvider } from "@/components/ui/tooltip";

const leadRecord = {
  id: "lead_1",
  name: "Taylor Smith",
  phone: "5551234567",
  email: "taylor@example.com",
  service_type: "Lawn Care",
  city: "Miami",
  address: "1 Main St",
  estimated_value: 1200,
  source: "Referral",
  status: "new",
  qualification_score: null,
  notes: null,
  created_at: "2026-03-20T00:00:00.000Z",
  updated_at: "2026-03-20T00:00:00.000Z",
  estimate_job_id: null,
  customer: null,
};

type InteractionRecord = {
  id: string;
  lead_id: string;
  type: "call" | "text" | "note" | "status_change" | "booking" | "system";
  direction: "inbound" | "outbound" | "na";
  summary: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

const renderLeadDetail = (
  leadOverrides: Partial<typeof leadRecord> = {},
  interactions: InteractionRecord[] = [],
) => {
  const testLeadRecord = { ...leadRecord, ...leadOverrides };

  vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
    if (table === "leads") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: testLeadRecord, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    }

    if (table === "interactions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: interactions, error: null }),
          })),
        })),
        insert: interactionsInsertMock,
      };
    }

    if (table === "lead_qualifications") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }

    if (table === "estimates") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/leads/lead_1"]}>
        <Routes>
          <Route path="/leads/:id" element={<LeadDetail />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
};

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: () => <header>Lead Detail</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/jobs/ClientShareLink", () => ({
  ClientShareLink: () => <div>client share link</div>,
}));

vi.mock("@/components/leads/CreateEstimateDialog", () => ({
  CreateEstimateDialog: () => null,
}));

vi.mock("@/components/leads/LineItemsEstimateDialog", () => ({
  LineItemsEstimateDialog: () => null,
}));

vi.mock("@/components/ui/speech-to-text-textarea", () => ({
  SpeechToTextTextarea: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      aria-label="speech to text textarea"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/mention-input", () => ({
  MentionInput: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      aria-label="mention input"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useCreateJob: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useLeads", () => ({
  useDeleteLead: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useScheduleJob", () => ({
  useScheduleJob: () => ({
    scheduleJob: vi.fn().mockResolvedValue({ ok: true }),
    isScheduling: false,
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: [],
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

const { supabaseFromMock } = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
}));

const { interactionsInsertMock } = vi.hoisted(() => ({
  interactionsInsertMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

const { openMapsWithAddressMock } = vi.hoisted(() => ({
  openMapsWithAddressMock: vi.fn(),
}));

vi.mock("@/lib/openMaps", () => ({
  openMapsWithAddress: openMapsWithAddressMock,
}));

describe("LeadDetail status guidance", () => {
  it("renders call and text quick actions as tel/sms links and logs interactions", async () => {
    interactionsInsertMock.mockClear();
    renderLeadDetail({
      phone: "(555) 123-4567",
    });

    await screen.findByText("Taylor Smith");

    const callLink = screen.getByRole("link", { name: /call lead/i });
    const textLink = screen.getByRole("link", { name: /text lead/i });

    expect(callLink).toHaveAttribute("href", "tel:5551234567");
    expect(textLink).toHaveAttribute("href", "sms:5551234567");

    fireEvent.click(callLink);
    fireEvent.click(textLink);
    expect(interactionsInsertMock).toHaveBeenCalledTimes(2);
  });

  it("shows a view-post action for posted interactions with a valid post link", async () => {
    renderLeadDetail(
      {},
      [
        {
          id: "interaction_1",
          lead_id: "lead_1",
          type: "text",
          direction: "outbound",
          summary: "Posted to social",
          body: "Posted via automation",
          metadata: {
            platform: "linkedin",
            post_url: "https://www.linkedin.com/posts/example-post",
          },
          created_by: null,
          created_at: "2026-03-20T00:00:00.000Z",
        },
      ],
    );

    await screen.findByText("Taylor Smith");

    const viewPostLink = screen.getByRole("link", { name: /view on linkedin/i });
    expect(viewPostLink).toHaveAttribute("href", "https://www.linkedin.com/posts/example-post");
    expect(viewPostLink).toHaveAttribute("target", "_blank");
  });

  it("does not visually display checklist lines for posted items in notes", async () => {
    renderLeadDetail(
      {},
      [
        {
          id: "interaction_2",
          lead_id: "lead_1",
          type: "note",
          direction: "na",
          summary: "Posted update",
          body: "Posted via automation\n- [x] Checklist item one\n- [ ] Checklist item two\nFinal caption",
          metadata: {
            platform: "linkedin",
            post_url: "https://www.linkedin.com/posts/example-post",
          },
          created_by: null,
          created_at: "2026-03-20T00:00:00.000Z",
        },
      ],
    );

    await screen.findByText("Taylor Smith");
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    expect(screen.getByText(/posted via automation/i)).toBeInTheDocument();
    expect(screen.getByText(/final caption/i)).toBeInTheDocument();
    expect(screen.queryByText(/checklist item one/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/checklist item two/i)).not.toBeInTheDocument();
  });

  it("uses a navigate quick action that opens maps for the lead address", async () => {
    renderLeadDetail();

    await screen.findByText("Taylor Smith");

    fireEvent.click(screen.getByRole("button", { name: /navigate to lead address/i }));

    expect(openMapsWithAddressMock).toHaveBeenCalledWith("1 Main St, Miami");
  });

  it("applies wrap-safe classes to long email values in details view", async () => {
    const longEmail = "lucas_galdine@thelongemailaddressproviderexample.com";
    renderLeadDetail({
      email: longEmail,
    });

    const emailValue = await screen.findByText(longEmail);
    expect(emailValue.className).toContain("break-all");
    expect(emailValue.className).toContain("min-w-0");
  });

  it("shows a three-dot lead actions menu near the lead name", async () => {
    renderLeadDetail({
      status: "qualified",
    });

    await screen.findByText("Taylor Smith");
    expect(screen.getByRole("button", { name: /open lead actions menu/i })).toBeInTheDocument();
  });

  it("opens a lead-only status guidance dialog from the header badge", async () => {
    renderLeadDetail();

    await screen.findByText("Taylor Smith");

    fireEvent.click(screen.getByRole("button", { name: /open lead status guide for new/i }));

    const dialog = await screen.findByRole("dialog");
    const dialogContent = within(dialog);

    expect(dialog.className).toContain("max-h-[80vh]");
    expect(dialog.className).toContain("overflow-y-auto");

    expect(dialogContent.getByText("Lead Status Stages")).toBeInTheDocument();
    expect(dialogContent.getByText(/created or imported and has not been worked yet/i)).toBeInTheDocument();
    expect(dialogContent.getByText(/received initial outreach or has already replied/i)).toBeInTheDocument();
    expect(dialogContent.getByText(/confirm budget, service fit, timeline, and decision-maker readiness/i)).toBeInTheDocument();
    expect(dialogContent.getByText(/added the address and city of the lead, then press the schedule vist button/i)).toBeInTheDocument();
    expect(dialogContent.getByText(/no longer active and should be treated as archived/i)).toBeInTheDocument();

    expect(dialogContent.queryByText("Scheduled")).not.toBeInTheDocument();
    expect(dialogContent.queryByText("In Progress")).not.toBeInTheDocument();
    expect(dialogContent.getAllByText("Job").length).toBeGreaterThan(0);

    const lostBadges = dialogContent.getAllByText("Lost");
    expect(lostBadges.some((node) => node.className.includes("status-attention"))).toBe(true);
  });

  it("explains why schedule visit is disabled when address details are missing", async () => {
    renderLeadDetail({
      status: "qualified",
      address: null,
      city: null,
    });

    await screen.findByText("Taylor Smith");

    fireEvent.click(screen.getByLabelText(/schedule visit unavailable/i));

    expect(screen.getByText("Add an address and city to schedule a visit.")).toBeInTheDocument();
  });
});
