import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

const {
  createJobMutateAsync,
  onOpenChangeMock,
  supabaseFromMock,
  jobLineItemsInsertMock,
  estimateInsertMock,
  estimateUpdateMock,
  estimateSelectMock,
  estimateLineItemsInsertMock,
  estimateLineItemsDeleteMock,
  estimateVersionsInsertMock,
  scheduleJobMock,
  toastSuccessMock,
  toastErrorMock,
  deleteJobMutateAsync,
  invalidateQueriesMock,
} = vi.hoisted(() => ({
  createJobMutateAsync: vi.fn().mockResolvedValue({ id: "job_1" }),
  deleteJobMutateAsync: vi.fn().mockResolvedValue(undefined),
  onOpenChangeMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  jobLineItemsInsertMock: vi.fn().mockResolvedValue({ error: null }),
  estimateInsertMock: vi.fn(),
  estimateUpdateMock: vi.fn(),
  estimateSelectMock: vi.fn(),
  estimateLineItemsInsertMock: vi.fn().mockResolvedValue({ error: null }),
  estimateLineItemsDeleteMock: vi.fn().mockResolvedValue({ error: null }),
  estimateVersionsInsertMock: vi.fn().mockResolvedValue({ error: null }),
  scheduleJobMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  invalidateQueriesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: {
      id: "acct_1",
      default_profit_margin: 20,
      default_surcharge: 10,
      default_tax_rate: 8,
    },
  }),
}));

vi.mock("@/hooks/useJobs", () => ({
  useCreateJob: () => ({
    mutateAsync: createJobMutateAsync,
  }),
  useDeleteJob: () => ({
    mutateAsync: deleteJobMutateAsync,
  }),
}));

vi.mock("@/hooks/useCustomers", () => ({
  useCreateCustomer: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useScheduleJob", () => ({
  useScheduleJob: () => ({
    scheduleJob: scheduleJobMock,
  }),
}));

vi.mock("@/hooks/useRecurringJobs", () => ({
  useConvertToRecurring: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "recurring_1" }),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({ data: [{ user_id: "crew_1", full_name: "Alex Crew", email: "alex@example.com" }] }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/components/jobs/JobCSVImportModal", () => ({
  JobCSVImportModal: () => null,
}));

vi.mock("@/components/clients/ClientSelector", () => ({
  ClientSelector: (props: { onSelect: (customer: any) => void; onModeChange: (mode: "existing" | "new") => void }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          props.onModeChange("existing");
          props.onSelect({
            id: "customer_1",
            name: "Test Client",
            phone: "5551112222",
            email: "test@example.com",
            address: "123 Main St",
          });
        }}
      >
        Mock Select Client
      </button>
    </div>
  ),
}));

vi.mock("@/components/scheduling/ScheduleDateBuilder", () => ({
  ScheduleDateBuilder: (props: { onSchedulesChange: (schedules: Array<{ date: string; timeStart: string; timeEnd: string }>) => void }) => (
    <div>
      <button
        type="button"
        onClick={() => props.onSchedulesChange([{ date: "2030-01-10", timeStart: "08:00", timeEnd: "10:00" }])}
      >
        Add Mock Schedule
      </button>
    </div>
  ),
}));

vi.mock("@/components/payments/EditEstimateModal", () => ({
  EditEstimateModal: (props: {
    open?: boolean;
    embedded?: boolean;
    onDraftSave?: (payload: {
      lineItems: Array<{
        name: string;
        description: string;
        quantity: string;
        unit: string;
        unit_price: string;
        category: "equipment" | "materials" | "labor" | "other";
      }>;
      profitMargin: string;
      surcharge: string;
    }) => void;
    onDraftChange?: (payload: {
      lineItems: Array<{
        name: string;
        description: string;
        quantity: string;
        unit: string;
        unit_price: string;
        category: "equipment" | "materials" | "labor" | "other";
      }>;
      profitMargin: string;
      surcharge: string;
    }) => void;
  }) => ((props.open || props.embedded) ? (
    <button
      type="button"
      onClick={() => {
        const payload = {
          lineItems: [
            {
              name: "Mulch",
              description: "",
              quantity: "2",
              unit: "item",
              unit_price: "100",
              category: "other",
            },
          ],
          profitMargin: "20",
          surcharge: "10",
        };
        props.onDraftSave?.(payload);
        props.onDraftChange?.(payload);
      }}
    >
      Fill Line Item
    </button>
  ) : null),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

function buildJobAssignmentsTableMock(options?: {
  conflicts?: Array<{
    user_id: string;
    job_schedules:
      | {
          scheduled_date: string;
          scheduled_time_start: string | null;
          scheduled_time_end: string | null;
        }
      | Array<{
          scheduled_date: string;
          scheduled_time_start: string | null;
          scheduled_time_end: string | null;
        }>;
  }>;
  insertError?: { message: string } | null;
}) {
  return {
    select: vi.fn(() => ({
      in: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: options?.conflicts || [],
          error: null,
        }),
      })),
    })),
    insert: vi.fn().mockResolvedValue({ error: options?.insertError ?? null }),
  };
}

describe("CreateJobDialog estimate flow", () => {
  beforeEach(() => {
    createJobMutateAsync.mockClear();
    onOpenChangeMock.mockClear();
    supabaseFromMock.mockReset();
    jobLineItemsInsertMock.mockClear();
    estimateInsertMock.mockReset();
    estimateUpdateMock.mockReset();
    estimateSelectMock.mockReset();
    estimateLineItemsInsertMock.mockClear();
    estimateLineItemsDeleteMock.mockClear();
    estimateVersionsInsertMock.mockClear();
    scheduleJobMock.mockReset();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    deleteJobMutateAsync.mockClear();
    invalidateQueriesMock.mockClear();
  });

  it("rolls back the created job when crew assignment fails", async () => {
    estimateSelectMock.mockReturnValue({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    });
    estimateInsertMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "est_1" }, error: null }),
      })),
    });
    scheduleJobMock.mockResolvedValue({ ok: true, scheduleId: "sched_1" });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_assignments") {
        return buildJobAssignmentsTableMock({ insertError: { message: "assignment failed" } });
      }
      if (table === "estimates") {
        return {
          select: estimateSelectMock,
          insert: estimateInsertMock,
        };
      }
      if (table === "estimate_line_items") {
        return { insert: estimateLineItemsInsertMock };
      }
      if (table === "estimate_versions") {
        return { insert: estimateVersionsInsertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);
    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /add mock schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.change(screen.getByLabelText("Find Crew Member"), { target: { value: "alex" } });
    fireEvent.click(screen.getByRole("button", { name: /alex crew/i }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /fill line item/i }));
    fireEvent.click(screen.getByRole("button", { name: /create job/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining("assignment failed"));
    });

    expect(deleteJobMutateAsync).toHaveBeenCalledWith("job_1");
    expect(onOpenChangeMock).not.toHaveBeenCalledWith(false);
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("rolls back the created job when a schedule cannot be saved", async () => {
    scheduleJobMock.mockResolvedValue({
      ok: false,
      error: new Error("Daily job limit reached (3) for 1/10/2030"),
    });
    estimateSelectMock.mockReturnValue({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    });
    estimateInsertMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "est_1" }, error: null }),
      })),
    });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "estimates") {
        return {
          select: estimateSelectMock,
          insert: estimateInsertMock,
        };
      }
      if (table === "estimate_line_items") {
        return { insert: estimateLineItemsInsertMock };
      }
      if (table === "estimate_versions") {
        return { insert: estimateVersionsInsertMock };
      }
      if (table === "job_assignments") {
        return buildJobAssignmentsTableMock();
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);
    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /add mock schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /fill line item/i }));
    fireEvent.click(screen.getByRole("button", { name: /create job/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining("Daily job limit reached"));
    });

    expect(deleteJobMutateAsync).toHaveBeenCalledWith("job_1");
    expect(onOpenChangeMock).not.toHaveBeenCalledWith(false);
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("reuses an existing estimate for the new job instead of failing", async () => {
    estimateSelectMock.mockReturnValue({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing_est_1" }, error: null }),
      })),
    });
    estimateUpdateMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_line_items") return { insert: jobLineItemsInsertMock };
      if (table === "estimates") {
        return {
          select: estimateSelectMock,
          update: estimateUpdateMock,
          insert: estimateInsertMock,
        };
      }
      if (table === "estimate_line_items") {
        return {
          delete: vi.fn(() => ({
            eq: estimateLineItemsDeleteMock,
          })),
          insert: estimateLineItemsInsertMock,
        };
      }
      if (table === "estimate_versions") {
        return { insert: estimateVersionsInsertMock };
      }
      if (table === "job_assignments") return buildJobAssignmentsTableMock();
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);
    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /fill line item/i }));
    fireEvent.click(screen.getByRole("button", { name: /create job/i }));

    await waitFor(() => {
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });

    expect(estimateUpdateMock).toHaveBeenCalled();
    expect(estimateLineItemsDeleteMock).toHaveBeenCalled();
    expect(estimateLineItemsInsertMock).toHaveBeenCalled();
  });

  it("creates estimate records from line items and does not write job costs", async () => {
    estimateSelectMock.mockReturnValue({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    });
    estimateInsertMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "est_1" }, error: null }),
      })),
    });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_line_items") {
        return { insert: jobLineItemsInsertMock };
      }
      if (table === "estimates") {
        return {
          select: estimateSelectMock,
          insert: estimateInsertMock,
        };
      }
      if (table === "estimate_line_items") {
        return { insert: estimateLineItemsInsertMock };
      }
      if (table === "estimate_versions") {
        return { insert: estimateVersionsInsertMock };
      }
      if (table === "job_assignments") {
        return buildJobAssignmentsTableMock();
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);

    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    fireEvent.click(screen.getByRole("button", { name: /fill line item/i }));
    fireEvent.click(screen.getByRole("button", { name: /create job/i }));

    await waitFor(() => {
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });

    expect(estimateInsertMock).toHaveBeenCalled();
    expect(estimateLineItemsInsertMock).toHaveBeenCalled();
    expect(estimateVersionsInsertMock).toHaveBeenCalled();
    expect(jobLineItemsInsertMock).not.toHaveBeenCalled();
  });

  it("refreshes jobs and assignment queries after creating a scheduled crew-assigned job", async () => {
    estimateSelectMock.mockReturnValue({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    });
    estimateInsertMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "est_1" }, error: null }),
      })),
    });
    scheduleJobMock.mockResolvedValue({ ok: true, scheduleId: "sched_1" });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_assignments") {
        return buildJobAssignmentsTableMock();
      }
      if (table === "estimates") {
        return {
          select: estimateSelectMock,
          insert: estimateInsertMock,
        };
      }
      if (table === "estimate_line_items") {
        return { insert: estimateLineItemsInsertMock };
      }
      if (table === "estimate_versions") {
        return { insert: estimateVersionsInsertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);
    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /add mock schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.change(screen.getByLabelText("Find Crew Member"), { target: { value: "alex" } });
    fireEvent.click(screen.getByRole("button", { name: /alex crew/i }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /fill line item/i }));
    fireEvent.click(screen.getByRole("button", { name: /create job/i }));

    await waitFor(() => {
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["jobs"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["job-counts"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["job", "job_1"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["job-assignments", "job_1"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["job-schedules", "job_1"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["scheduled-jobs"] });
  });

  it("marks a crew member unavailable when all selected days conflict", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_assignments") {
        return buildJobAssignmentsTableMock({
          conflicts: [
            {
              user_id: "crew_1",
              job_schedules: {
                scheduled_date: "2030-01-10",
                scheduled_time_start: "09:00",
                scheduled_time_end: "11:00",
              },
            },
          ],
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);
    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /add mock schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.change(screen.getByLabelText("Find Crew Member"), { target: { value: "alex" } });
    const crewButton = screen.getByRole("button", { name: /alex crew/i });

    await waitFor(() => {
      expect(crewButton).toBeDisabled();
    });

    expect(screen.getByText(/^Unavailable$/i)).toBeInTheDocument();
    fireEvent.click(crewButton);
    expect(screen.queryByText(/assign days for/i)).not.toBeInTheDocument();
  });

  it("does not create a job when selected crew is already assigned at overlapping time", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "job_assignments") {
        return buildJobAssignmentsTableMock({
          conflicts: [
            {
              user_id: "crew_1",
              job_schedules: {
                scheduled_date: "2030-01-10",
                scheduled_time_start: "09:00",
                scheduled_time_end: "11:00",
              },
            },
          ],
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<CreateJobDialog open onOpenChange={onOpenChangeMock} />);
    fireEvent.click(screen.getByRole("button", { name: /mock select client/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /add mock schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.change(screen.getByLabelText("Find Crew Member"), { target: { value: "alex" } });
    fireEvent.click(screen.getByRole("button", { name: /alex crew/i }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /create job/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining("already assigned"));
    });

    expect(createJobMutateAsync).not.toHaveBeenCalled();
    expect(deleteJobMutateAsync).not.toHaveBeenCalled();
  });
});
