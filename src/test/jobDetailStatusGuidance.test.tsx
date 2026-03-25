import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import JobDetail from "@/pages/JobDetail";

const jobRecord = {
  id: "job_1",
  name: "Front Yard Cleanup",
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
    data: [{ id: "sched_1", scheduled_date: "2026-03-25" }],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useJobAssignments", () => ({
  useJobAssignments: () => ({
    assignments: [{ id: "assign_1", user_id: "crew_1" }],
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

const { supabaseFromMock } = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

describe("JobDetail status guidance", () => {
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

    await screen.findByText("Taylor Smith");

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
});
