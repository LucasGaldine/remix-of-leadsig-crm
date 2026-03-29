import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JobDetail from "@/pages/JobDetail";

const jobRecord = {
  id: "job_1",
  name: "Front Yard Cleanup",
  description:
    "Clean up leaves in the front yard, trim shrubs along the walkway, and haul away all debris after finishing the service.",
  status: "scheduled",
  display_status: "scheduled",
  service_type: "Lawn Care",
  address: "1 Main St",
  city: "Miami",
  actual_value: 1800,
  is_estimate_visit: false,
  recurring_job_id: null,
  recurring_instance_number: null,
  customer: {
    id: "cust_1",
    name: "Taylor Smith",
    phone: "5551234567",
  },
};

const renderJobDetail = () =>
  render(
    <MemoryRouter initialEntries={["/jobs/job_1"]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>,
  );

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: () => <header>Job Detail</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/jobs/JobAssignments", () => ({
  JobAssignments: () => <div>job assignments</div>,
}));

vi.mock("@/components/photos/PhotoSection", () => ({
  PhotoSection: () => <div>photo section</div>,
}));

vi.mock("@/components/jobs/ClientShareLink", () => ({
  ClientShareLink: () => <div>client share link</div>,
}));

vi.mock("@/components/jobs/JobChecklist", () => ({
  JobChecklist: () => <div>job checklist</div>,
}));

vi.mock("@/components/jobs/MakeRecurringDialog", () => ({
  MakeRecurringDialog: () => null,
}));

vi.mock("@/components/jobs/EditJobScheduleDialog", () => ({
  EditJobScheduleDialog: () => null,
}));

vi.mock("@/components/jobs/RecurringJobDetailModal", () => ({
  RecurringJobDetailModal: () => null,
}));

vi.mock("@/components/jobs/ScheduleJobDialog", () => ({
  ScheduleJobDialog: () => null,
}));

vi.mock("@/components/jobs/JobInvoiceCard", () => ({
  JobInvoiceCard: () => <div>job invoice card</div>,
}));

vi.mock("@/components/jobs/JobTimeTracker", () => ({
  JobTimeTracker: () => <div>job time tracker</div>,
}));

vi.mock("@/components/jobs/JobCosts", () => ({
  JobCosts: () => <div>job costs</div>,
}));

vi.mock("@/components/leads/LineItemsEstimateDialog", () => ({
  LineItemsEstimateDialog: ({ open }: { open: boolean }) =>
    open ? <div>Line Items Estimate Modal</div> : null,
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
    isManager: () => true,
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useJob: () => ({
    data: jobRecord,
    isLoading: false,
    error: null,
  }),
  useUpdateJob: () => ({
    mutateAsync: vi.fn(),
  }),
  useDeleteJob: () => ({
    mutateAsync: vi.fn(),
  }),
  useMakeJobUnique: () => ({
    mutateAsync: vi.fn(),
  }),
}));

const { testState, supabaseFromMock } = vi.hoisted(() => ({
  testState: {
    schedules: [{ id: "sched_1", scheduled_date: "2026-03-25" }],
    assignments: [{ id: "assign_1", user_id: "crew_1" }],
  },
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/hooks/useJobSchedules", () => ({
  useJobSchedules: () => ({
    data: testState.schedules,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useJobAssignments", () => ({
  useJobAssignments: () => ({
    assignments: testState.assignments,
  }),
}));

vi.mock("@/hooks/useBusinessHours", () => ({
  useBusinessHours: () => ({
    businessHours: [],
  }),
}));

vi.mock("@/hooks/useScheduleJob", () => ({
  useScheduleJob: () => ({
    scheduleJob: vi.fn(),
    deleteSchedule: {
      mutateAsync: vi.fn(),
    },
    isScheduling: false,
  }),
}));

vi.mock("@/hooks/useRecurringJobs", () => ({
  useRecurringJob: () => ({ data: null }),
  useGenerateNextInstances: () => ({ mutate: vi.fn() }),
  useUpdateRecurringJobCrew: () => ({ mutateAsync: vi.fn() }),
  useRecurringJobEstimate: () => ({ data: null }),
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

describe("JobDetail status guidance", () => {
  beforeEach(() => {
    testState.schedules = [{ id: "sched_1", scheduled_date: "2026-03-25" }];
    testState.assignments = [{ id: "assign_1", user_id: "crew_1" }];
  });

  it("opens a job-only status guidance dialog from the header badge", async () => {
    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
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

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();

    await screen.findByRole("button", { name: /open job status guide for scheduled/i });

    fireEvent.click(screen.getByRole("button", { name: /open job status guide for scheduled/i }));

    const dialog = await screen.findByRole("dialog");
    const dialogContent = within(dialog);

    expect(dialogContent.getByText("Job Status Stages")).toBeInTheDocument();
    expect(dialogContent.getAllByText("Unscheduled").length).toBeGreaterThan(0);
    expect(dialogContent.getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(dialogContent.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(dialogContent.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(dialogContent.getAllByText("Needs Invoice").length).toBeGreaterThan(0);
    expect(dialogContent.getAllByText("Paid").length).toBeGreaterThan(0);

    expect(dialogContent.queryByText("Qualified")).not.toBeInTheDocument();
    expect(dialogContent.queryByText("Contacted")).not.toBeInTheDocument();
  });

  it("shows unassigned badge when at least one scheduled day has no crew assignment", async () => {
    testState.schedules = [
      { id: "sched_1", scheduled_date: "2026-03-25" },
      { id: "sched_2", scheduled_date: "2026-03-26" },
    ];
    testState.assignments = [
      { id: "assign_1", user_id: "crew_1", job_schedule_id: "sched_1" },
    ];

    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
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

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();

    await screen.findByRole("button", { name: /open job status guide for scheduled/i });
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("shows job information in a collapsed header dropdown and keeps detail content in a single left-column card", async () => {
    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
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

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();

    await screen.findByRole("button", { name: /open job status guide for scheduled/i });

    const descriptionPreview = screen.getByTestId("job-description-preview");
    expect(descriptionPreview).toHaveTextContent(jobRecord.description);
    expect(descriptionPreview).toHaveClass("line-clamp-3");
    expect(screen.queryByText("Taylor Smith")).not.toBeInTheDocument();

    const infoToggle = screen.getByRole("button", { name: /more info/i });
    expect(screen.queryByText("Lawn Care")).not.toBeInTheDocument();

    fireEvent.click(infoToggle);
    expect(await screen.findByText("Lawn Care")).toBeInTheDocument();
    expect(screen.getByText("1 Main St, Miami")).toBeInTheDocument();
    const customerLink = screen.getByRole("link", { name: "Taylor Smith" });
    expect(customerLink).toBeInTheDocument();
    expect(customerLink).toHaveAttribute("href", "/customers/cust_1");
    expect(descriptionPreview).not.toHaveClass("line-clamp-3");
    expect(screen.getAllByText(jobRecord.description)).toHaveLength(1);

    const leftColumn = screen.getByTestId("job-details-left-column");
    const rightColumn = screen.getByTestId("job-details-right-column");
    const leftCard = within(leftColumn).getByTestId("job-details-left-card");

    expect(within(leftCard).getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(within(leftCard).getByRole("button", { name: "Checklist" })).toBeInTheDocument();
    expect(within(leftCard).getByRole("button", { name: "Photos" })).toBeInTheDocument();
    expect(within(leftCard).getByRole("button", { name: "Notes" })).toBeInTheDocument();

    expect(within(leftCard).getByText("Schedule")).toBeInTheDocument();
    expect(within(leftCard).queryByText("Wednesday, Mar 25, 2026")).not.toBeInTheDocument();
    expect(within(leftCard).getByText("Wed, Mar 25, 2026")).toBeInTheDocument();
    expect(within(leftCard).getByRole("button", { name: "Add Date" })).toBeInTheDocument();
    expect(within(leftCard).queryByRole("button", { name: "Recurring" })).not.toBeInTheDocument();
    expect(within(leftCard).getByText("No crew assigned")).toBeInTheDocument();
    expect(within(leftCard).getByRole("button", { name: "Edit Crew" })).toBeInTheDocument();

    expect(within(rightColumn).getByText("job costs")).toBeInTheDocument();
    expect(within(rightColumn).getByText("Invoices")).toBeInTheDocument();
    expect(within(rightColumn).getByText("job invoice card")).toBeInTheDocument();
  });

  it("keeps the right column stable when switching tabs", async () => {
    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
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

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();
    await screen.findByRole("button", { name: /open job status guide for scheduled/i });

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    const leftColumn = screen.getByTestId("job-details-left-column");
    const rightColumn = screen.getByTestId("job-details-right-column");

    expect(within(leftColumn).getByLabelText("mention input")).toBeInTheDocument();
    expect(within(leftColumn).queryByText("Schedule")).not.toBeInTheDocument();
    expect(within(rightColumn).getByText("job costs")).toBeInTheDocument();
    expect(within(rightColumn).getByText("Invoices")).toBeInTheDocument();
    expect(within(rightColumn).getByText("job invoice card")).toBeInTheDocument();
  });

  it("opens line items estimate modal when clicking Build Estimate", async () => {
    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
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

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();

    await screen.findByRole("button", { name: /open job status guide for scheduled/i });

    fireEvent.click(screen.getByRole("button", { name: /build estimate/i }));

    expect(await screen.findByText("Line Items Estimate Modal")).toBeInTheDocument();
  });

  it("shows Build Estimate when only an auto-generated placeholder estimate exists", async () => {
    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      if (table === "estimates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "est_1",
                  total: 0,
                  status: "draft",
                  notes: "Auto-generated estimate for Kevin Johnson, Hardscaping Job",
                  line_items: [],
                },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();
    await screen.findByRole("button", { name: /open job status guide for scheduled/i });

    expect(screen.getByRole("button", { name: /build estimate/i })).toBeInTheDocument();
    expect(screen.queryByText("$0 · draft")).not.toBeInTheDocument();
  });

  it("keeps estimate card desktop typography at the previous sizes", async () => {
    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      if (table === "estimates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "est_1",
                  total: 2688,
                  status: "draft",
                  notes: null,
                  line_items: [{ id: "item_1" }],
                },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();
    await screen.findByRole("button", { name: /open job status guide for scheduled/i });

    const price = screen.getByText("$2,688.00");
    const lineItems = screen.getByText("1 line item");
    const cta = screen.getByText("View Details");

    expect(price).toHaveClass("md:text-3xl");
    expect(lineItems).toHaveClass("md:text-md");
    expect(cta).toHaveClass("md:text-sm");
  });

  it("uses neutral card styling for the estimate details card", async () => {
    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      if (table === "estimates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "est_1",
                  total: 2688,
                  status: "draft",
                  notes: null,
                  line_items: [{ id: "item_1" }],
                },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "lead_photos" || table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            })),
          })),
        };
      }

      if (table === "interactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderJobDetail();
    await screen.findByRole("button", { name: /open job status guide for scheduled/i });

    const estimateCardButton = screen.getByRole("button", { name: /job estimate.*view details/i });
    expect(estimateCardButton).toHaveClass("bg-card");
    expect(estimateCardButton).toHaveClass("text-foreground");
    expect(estimateCardButton).not.toHaveAttribute("style");
  });
});
