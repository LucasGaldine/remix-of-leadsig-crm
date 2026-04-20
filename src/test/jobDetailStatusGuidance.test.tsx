import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { testState, supabaseFromMock, deleteScheduleMutateAsyncMock } = vi.hoisted(() => ({
  testState: {
    schedules: [
      {
        id: "sched_1",
        scheduled_date: "2026-03-25",
        scheduled_time_start: "08:00",
        scheduled_time_end: "12:00",
      },
    ],
    assignments: [{ id: "assign_1", user_id: "crew_1" }],
    checklistItems: [],
    teamMembers: [] as Array<{ user_id: string; full_name?: string | null; role?: string | null; email?: string | null }>,
  },
  supabaseFromMock: vi.fn(),
  deleteScheduleMutateAsyncMock: vi.fn(),
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

vi.mock("@/hooks/useJobChecklist", () => ({
  useJobChecklist: () => ({
    items: testState.checklistItems,
    isLoading: false,
    toggleItem: { mutateAsync: vi.fn() },
    addItem: { mutateAsync: vi.fn() },
    updateItem: { mutateAsync: vi.fn() },
    deleteItem: { mutateAsync: vi.fn() },
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
      mutateAsync: deleteScheduleMutateAsyncMock,
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
    data: testState.teamMembers,
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
  afterEach(() => {
    supabaseFromMock.mockReset();
  });

  beforeEach(() => {
    testState.schedules = [
      {
        id: "sched_1",
        scheduled_date: "2026-03-25",
        scheduled_time_start: "08:00",
        scheduled_time_end: "12:00",
      },
    ];
    testState.assignments = [{ id: "assign_1", user_id: "crew_1" }];
    testState.checklistItems = [];
    testState.teamMembers = [
      { user_id: "owner_1", full_name: "Owner One", email: "owner@example.com" },
      { user_id: "crew_1", full_name: "Crew One", email: "crew@example.com" },
    ];
    deleteScheduleMutateAsyncMock.mockReset();
    deleteScheduleMutateAsyncMock.mockResolvedValue(undefined);
  });

  it("does not call the send-sms edge function on initial render", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: "event_type and account_id are required" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
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
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  })),
                })),
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

      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/functions/v1/send-sms")),
      ).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
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

  it("opens status guidance when clicking a warning badge in the header row", async () => {
    testState.assignments = [];

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

    const badgesRow = await screen.findByTestId("job-detail-badges-row");
    fireEvent.click(within(badgesRow).getByText("Unassigned"));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Job Status Stages")).toBeInTheDocument();
  });

  it("fetches the latest estimate using updated_at then created_at ordering", async () => {
    const firstEstimateOrderMock = vi.fn();
    const secondEstimateOrderMock = vi.fn();
    const estimateLimitMock = vi.fn();

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
        const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
        estimateLimitMock.mockReturnValue({ maybeSingle: maybeSingleMock });
        secondEstimateOrderMock.mockReturnValue({ limit: estimateLimitMock });
        firstEstimateOrderMock.mockReturnValue({ order: secondEstimateOrderMock });
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: firstEstimateOrderMock,
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

    await waitFor(() => {
      expect(firstEstimateOrderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
      expect(secondEstimateOrderMock).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(estimateLimitMock).toHaveBeenCalledWith(1);
    });
  });

  it("shows tasks-left copy in the status badge row when checklist tasks are incomplete", async () => {
    testState.checklistItems = [
      { id: "item_1", is_completed: false },
      { id: "item_2", is_completed: true },
      { id: "item_3", is_completed: false },
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
    expect(screen.getByText("2 tasks left")).toBeInTheDocument();
    const badgesRow = screen.getByTestId("job-detail-badges-row");
    expect(badgesRow.className).not.toContain("justify-between");
    expect(screen.queryByText("tasks left")).not.toBeInTheDocument();
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

  it("hides unassigned badge when the company has only one real member", async () => {
    testState.schedules = [
      { id: "sched_1", scheduled_date: "2026-03-25" },
      { id: "sched_2", scheduled_date: "2026-03-26" },
    ];
    testState.assignments = [
      { id: "assign_1", user_id: "owner_1", job_schedule_id: "sched_1" },
    ];
    testState.teamMembers = [{ user_id: "owner_1", full_name: "Owner One", email: "owner@example.com" }];

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
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });

  it("hides no-crew copy and crew assignment controls for single-person companies", async () => {
    testState.schedules = [
      {
        id: "sched_1",
        scheduled_date: "2026-03-25",
        scheduled_time_start: "08:00",
        scheduled_time_end: "12:00",
      },
    ];
    testState.assignments = [];
    testState.teamMembers = [{ user_id: "owner_1", full_name: "Owner One", email: "owner@example.com" }];

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

    expect(screen.queryByText("No crew assigned")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit schedule for/i }));

    const dialog = await screen.findByRole("dialog");
    const modal = within(dialog);
    expect(modal.getByText("Edit Schedule")).toBeInTheDocument();
    expect(modal.queryByText("Owner One")).not.toBeInTheDocument();
    expect(modal.queryByText(/crew member.*selected/i)).not.toBeInTheDocument();
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
    expect(within(leftCard).getByText("MAR")).toBeInTheDocument();
    expect(within(leftCard).getByText("25")).toBeInTheDocument();
    expect(within(leftCard).getByText("Wed, Mar 25")).toBeInTheDocument();
    expect(within(leftCard).getByText("8:00 AM - 12:00 PM")).toBeInTheDocument();
    expect(within(leftCard).getByRole("button", { name: "Add Date" })).toBeInTheDocument();
    expect(within(leftCard).queryByRole("button", { name: "Recurring" })).not.toBeInTheDocument();
    expect(within(leftCard).getByText("No crew assigned")).toBeInTheDocument();
    expect(within(leftCard).getByRole("button", { name: /edit schedule and crew for/i })).toBeInTheDocument();

    expect(within(rightColumn).getByText("job costs")).toBeInTheDocument();
    expect(within(rightColumn).getByText("Invoices")).toBeInTheDocument();
    expect(within(rightColumn).getByText("job invoice card")).toBeInTheDocument();
  });

  it("renders quick actions on the same row as the more info toggle", async () => {
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

    const infoToggle = screen.getByRole("button", { name: /more info/i });
    const callButton = screen.getByRole("button", { name: /call/i });
    const actionsRow = screen.getByTestId("job-header-actions-row");

    expect(actionsRow).toContainElement(infoToggle);
    expect(actionsRow).toContainElement(callButton);
    expect(actionsRow).toHaveClass("flex");
    expect(actionsRow).toHaveClass("items-center");
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

  it("updates only the selected scheduled instance when editing date and time", async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({
      eq: updateEqMock,
    }));

    vi.mocked(supabaseFromMock).mockImplementation((table: string) => {
      if (table === "job_schedules") {
        return {
          update: updateMock,
        };
      }

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

    fireEvent.click(screen.getByRole("button", { name: /edit schedule and crew for/i }));

    const dialog = await screen.findByRole("dialog");
    const modal = within(dialog);

    fireEvent.change(modal.getByLabelText("Date"), { target: { value: "2026-03-26" } });
    fireEvent.change(modal.getByLabelText("Start Time"), { target: { value: "09:00" } });
    fireEvent.change(modal.getByLabelText("End Time"), { target: { value: "11:30" } });
    fireEvent.click(modal.getByRole("button", { name: "Save Crew" }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduled_date: "2026-03-26",
          scheduled_time_start: "09:00",
          scheduled_time_end: "11:30",
        }),
      );
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "sched_1");
  });

  it("deletes a single scheduled date from the edit modal with confirmation", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /edit schedule and crew for/i }));

    const editDialog = await screen.findByRole("dialog");
    fireEvent.click(within(editDialog).getByRole("button", { name: /delete scheduled date/i }));

    const confirmationDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmationDialog).getByRole("button", { name: /remove date/i }));

    await waitFor(() => {
      expect(deleteScheduleMutateAsyncMock).toHaveBeenCalledWith({
        id: "sched_1",
        lead_id: "job_1",
      });
    });
  });

  it("disables crew member selection when mark as assigned is checked", async () => {
    testState.teamMembers = [
      { user_id: "crew_1", full_name: "Lucas Galdine", role: "owner" },
      { user_id: "crew_2", full_name: "Test Crew", role: "crew_member" },
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

    fireEvent.click(screen.getByRole("button", { name: /edit schedule and crew for/i }));

    const dialog = await screen.findByRole("dialog");
    const modal = within(dialog);

    const markAssignedCheckbox = modal.getByLabelText(/mark as assigned/i);
    fireEvent.click(markAssignedCheckbox);

    const crewCheckbox = modal.getByLabelText("Lucas Galdine");
    expect(crewCheckbox).toBeDisabled();
  });

  it("disables mark as assigned after selecting a crew member", async () => {
    testState.teamMembers = [
      { user_id: "crew_1", full_name: "Lucas Galdine", role: "owner" },
      { user_id: "crew_2", full_name: "Test Crew", role: "crew_member" },
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

    fireEvent.click(screen.getByRole("button", { name: /edit schedule and crew for/i }));

    const dialog = await screen.findByRole("dialog");
    const modal = within(dialog);

    fireEvent.click(modal.getByLabelText("Lucas Galdine"));
    const markAssignedCheckbox = modal.getByLabelText(/mark as assigned/i);
    expect(markAssignedCheckbox).toBeDisabled();
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
