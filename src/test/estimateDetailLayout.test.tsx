import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EstimateDetail from "@/pages/EstimateDetail";

const { generateEstimatePDF } = vi.hoisted(() => ({
  generateEstimatePDF: vi.fn().mockResolvedValue(undefined),
}));

const buildEstimate = (overrides: Record<string, unknown> = {}) => ({
  id: "est_1",
  status: "sent",
  subtotal: 1200,
  profit_margin: 0,
  tax_rate: 0.07,
  tax: 84,
  discount: 0,
  total: 1284,
  notes: "Customer requested premium materials.",
  has_pending_changes: true,
  expires_at: "2026-04-10T00:00:00.000Z",
  accepted_at: null,
  approved_via: null,
  manual_approval_photo_url: null,
  job_id: "job_1",
  recurring_job_id: null,
  customer: { id: "cust_1", name: "Taylor Smith" },
  job: { id: "job_1", name: "Front Yard Renovation" },
  recurring_job: null,
  line_items: [
    {
      id: "line_1",
      name: "Paver installation",
      description: "Install pavers and compact base.",
      category: "labor",
      quantity: 1,
      unit: "job",
      unit_price: 1200,
      total: 1200,
      sort_order: 0,
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
    },
    {
      id: "line_2",
      name: "Compactor rental",
      description: "Rental for plate compactor.",
      category: "equipment",
      quantity: 1,
      unit: "day",
      unit_price: 200,
      total: 200,
      sort_order: 1,
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
    },
    {
      id: "line_3",
      name: "Paver materials",
      description: "Pavers and base stone.",
      category: "materials",
      quantity: 1,
      unit: "job",
      unit_price: 1000,
      total: 1000,
      sort_order: 2,
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
    },
    {
      id: "line_4",
      name: "Jointing sand",
      description: "Polymeric sand for joints.",
      category: "materials",
      quantity: 1,
      unit: "bag",
      unit_price: 80,
      total: 80,
      sort_order: 3,
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
    },
  ],
  original_total: 1200,
  original_line_items: [
    {
      id: "orig_line_1",
      name: "Original labor",
      description: "Original scope",
      category: "labor",
      quantity: 1,
      unit: "job",
      unit_price: 1200,
      total: 1200,
      sort_order: 0,
      is_change_order: false,
      change_order_type: null,
      change_order_approved: null,
      changed_at: null,
    },
  ],
  ...overrides,
});

let mockEstimate = buildEstimate();

const invalidateQueriesMock = vi.fn();
const estimateUpdateMock = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const lineItemUpdateEqMock = vi.fn(() => ({
  eq: lineItemUpdateEqMock,
}));
const lineItemUpdateMock = vi.fn(() => ({
  eq: lineItemUpdateEqMock,
}));
const estimateSelectMock = vi.fn(() => ({
  eq: vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));
const estimateVersionsOrderMock = vi.fn().mockResolvedValue({ data: [], error: null });
const estimateVersionsEqMock = vi.fn(() => ({
  order: estimateVersionsOrderMock,
}));
const estimateVersionsSelectMock = vi.fn(() => ({
  eq: estimateVersionsEqMock,
}));
const estimateVersionsInsertMock = vi.fn().mockResolvedValue({ error: null });
const storageUploadMock = vi.fn().mockResolvedValue({ error: null });
const storageGetPublicUrlMock = vi.fn(() => ({
  data: { publicUrl: "https://example.com/manual-approval-photo.jpg" },
}));
const storageRemoveMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: any }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: any }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: any }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
    disabled,
  }: {
    children: any;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/payments/EditEstimateModal", () => ({
  EditEstimateModal: () => null,
}));

vi.mock("@/components/payments/CreateInvoiceModal", () => ({
  CreateInvoiceModal: () => null,
}));

vi.mock("@/components/jobs/JobInvoiceCard", () => ({
  JobInvoiceCard: () => <div>job invoice card</div>,
}));

vi.mock("@/lib/pdfGenerator", () => ({
  generateEstimatePDF,
}));

vi.mock("@/lib/photoCompression", () => ({
  prepareLeadPhotoForUpload: vi.fn(async (file: File) => file),
}));

vi.mock("@/hooks/useEstimates", () => ({
  useEstimate: () => ({
    isLoading: false,
    data: mockEstimate,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({
    data: [
      {
        id: "inv_1",
        estimate_id: "est_1",
        invoice_number: 101,
        status: "sent",
        total: 640,
        balance_due: 640,
        due_date: "2026-04-05T00:00:00.000Z",
      },
    ],
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "estimates") {
        return {
          update: estimateUpdateMock,
          select: estimateSelectMock,
        };
      }

      if (table === "estimate_line_items") {
        return {
          update: lineItemUpdateMock,
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }

      if (table === "estimate_versions") {
        return {
          select: estimateVersionsSelectMock,
          insert: estimateVersionsInsertMock,
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      return {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };
    }),
    storage: {
      from: vi.fn(() => ({
        upload: storageUploadMock,
        getPublicUrl: storageGetPublicUrlMock,
        remove: storageRemoveMock,
      })),
    },
  },
}));

describe("EstimateDetail layout", () => {
  beforeEach(() => {
    mockEstimate = buildEstimate();
    invalidateQueriesMock.mockClear();
    estimateUpdateMock.mockClear();
    lineItemUpdateMock.mockClear();
    lineItemUpdateEqMock.mockClear();
    estimateSelectMock.mockClear();
    estimateVersionsOrderMock.mockClear();
    estimateVersionsEqMock.mockClear();
    estimateVersionsSelectMock.mockClear();
    estimateVersionsInsertMock.mockClear();
    generateEstimatePDF.mockClear();
    storageUploadMock.mockClear();
    storageGetPublicUrlMock.mockClear();
    storageRemoveMock.mockClear();
  });

  it("uses a two-column detail layout and keeps quick actions in the header", async () => {
    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const headerActions = await screen.findByTestId("estimate-header-quick-actions");
    const summaryRow = screen.getByTestId("estimate-header-summary-row");
    const leftColumn = await screen.findByTestId("estimate-details-left-column");
    const rightColumn = screen.getByTestId("estimate-details-right-column");

    expect(within(summaryRow).getByRole("heading", { name: /^Estimate$/i })).toBeInTheDocument();
    expect(within(summaryRow).getByText("$1,284")).toBeInTheDocument();

    expect(within(leftColumn).getByRole("heading", { name: /line items/i })).toBeInTheDocument();
    expect(within(leftColumn).getByRole("heading", { name: /notes/i })).toBeInTheDocument();
    expect(within(leftColumn).getByText("Compactor rental")).toBeInTheDocument();
    expect(within(leftColumn).getByText("Paver materials")).toBeInTheDocument();
    expect(within(leftColumn).getByText("Jointing sand")).toBeInTheDocument();
    expect(within(leftColumn).getByText("Paver installation")).toBeInTheDocument();
    expect(within(leftColumn).getByTestId("pending-changes-alert")).toBeInTheDocument();
    expect(
      within(leftColumn).queryByText(/changes have been sent to the customer for review/i),
    ).not.toBeInTheDocument();

    const categoryHeadings = within(leftColumn).getAllByTestId("line-item-category-heading");
    expect(categoryHeadings.map((heading) => heading.textContent)).toEqual(["Equipment", "Materials", "Labor"]);
    categoryHeadings.forEach((heading) => {
      expect(heading).toHaveClass("text-xs");
      expect(heading).toHaveClass("uppercase");
      expect(heading).toHaveClass("tracking-wide");
    });

    const materialsRow = within(leftColumn)
      .getByText("Paver materials")
      .closest("div.flex-1")
      ?.parentElement
      ?.parentElement as HTMLElement;
    expect(materialsRow).not.toHaveClass("border-b");
    expect(within(leftColumn).getByTestId("line-items-header-row")).not.toHaveClass("border-t");

    const compareTabs = within(leftColumn).getByRole("tablist");
    const pendingAlert = within(leftColumn).getByTestId("pending-changes-alert");
    expect(
      compareTabs.compareDocumentPosition(pendingAlert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(compareTabs).getByRole("tab", { name: /^Current$/i })).toBeInTheDocument();
    expect(within(compareTabs).getByRole("tab", { name: /^Original$/i })).toBeInTheDocument();

    const originalTab = within(compareTabs).getByRole("tab", { name: /^Original$/i });
    fireEvent.mouseDown(originalTab);
    fireEvent.click(originalTab);
    expect(within(leftColumn).queryByTestId("pending-changes-alert")).not.toBeInTheDocument();
    const approvedHeading = within(leftColumn).getByText("Approved");
    expect(approvedHeading).toBeInTheDocument();
    expect(
      compareTabs.compareDocumentPosition(approvedHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(headerActions).toHaveClass("flex-nowrap");
    expect(within(headerActions).getByRole("button", { name: /^Manually Approve$/i })).toBeInTheDocument();
    expect(within(headerActions).getByRole("button", { name: /^Send Client Portal$/i })).toBeInTheDocument();
    expect(
      within(headerActions).queryByRole("button", { name: /open estimate actions menu/i }),
    ).not.toBeInTheDocument();

    expect(within(rightColumn).getByText("Client")).toBeInTheDocument();
    expect(within(rightColumn).getByText("View Job")).toBeInTheDocument();
  });

  it("shows scheduled status on the job card when schedules exist for a raw job status", async () => {
    mockEstimate = buildEstimate({
      job: {
        id: "job_1",
        name: "Front Yard Renovation",
        status: "job",
        scheduled_date: null,
        job_schedules: [
          {
            scheduled_date: "2099-01-10",
            scheduled_time_start: "09:00:00",
            scheduled_time_end: "11:00:00",
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const rightColumn = await screen.findByTestId("estimate-details-right-column");
    expect(within(rightColumn).getByText("Scheduled")).toBeInTheDocument();
    expect(within(rightColumn).queryByText("Unscheduled")).not.toBeInTheDocument();
  });

  it("downloads the currently selected estimate version from the actions menu", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      original_total: null,
      original_line_items: null,
    });

    estimateVersionsOrderMock.mockResolvedValueOnce({
      data: [
        {
          id: "ver_1",
          name: "Version 1",
          subtotal: 100,
          tax_rate: 0.1,
          tax: 10,
          discount: 0,
          total: 110,
          profit_margin: 0,
          surcharge: 0,
          notes: "Version 1 notes",
          line_items: [
            {
              name: "Version 1 item",
              description: "Version 1 description",
              quantity: 1,
              unit: "each",
              unit_price: 100,
              total: 100,
              sort_order: 0,
              category: "materials",
            },
          ],
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "ver_2",
          name: "Version 2",
          subtotal: 200,
          tax_rate: 0.1,
          tax: 20,
          discount: 5,
          total: 215,
          profit_margin: 0,
          surcharge: 0,
          notes: "Version 2 notes",
          line_items: [
            {
              name: "Version 2 item",
              description: "Version 2 description",
              quantity: 2,
              unit: "each",
              unit_price: 100,
              total: 200,
              sort_order: 0,
              category: "labor",
            },
          ],
          created_at: "2026-04-02T00:00:00.000Z",
          updated_at: "2026-04-02T00:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const versionTwoTab = await screen.findByRole("tab", { name: /version 2/i });
    fireEvent.mouseDown(versionTwoTab);
    fireEvent.click(versionTwoTab);

    const versionActionsButton = screen.getByRole("button", { name: /version actions/i });
    expect(versionActionsButton).toBeInTheDocument();
    fireEvent.click(versionActionsButton);
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(generateEstimatePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: [
            expect.objectContaining({
              name: "Version 2 item",
              description: "Version 2 description",
              quantity: 2,
              unit: "each",
              unit_price: 100,
              total: 200,
            }),
          ],
          subtotal: 200,
          taxRate: 0.1,
          tax: 20,
          discount: 5,
          total: 215,
          notes: "Version 2 notes",
          createdAt: "2026-04-02T00:00:00.000Z",
        }),
      );
    });
  });

  it("creates a new version from the selected estimate version", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      original_total: null,
      original_line_items: null,
    });

    estimateVersionsOrderMock
      .mockResolvedValueOnce({
      data: [
        {
          id: "ver_1",
          name: "Version 1",
          subtotal: 111,
          tax_rate: 0.05,
          tax: 5.55,
          discount: 3,
          total: 113.55,
          profit_margin: 11,
          surcharge: 9,
          notes: "Version 1 notes",
          line_items: [
            {
              name: "Version 1 item",
              description: "Version 1 description",
              quantity: 3,
              unit: "ea",
              unit_price: 37,
              total: 111,
              sort_order: 0,
              category: "labor",
            },
          ],
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "ver_2",
          name: "Version 2",
          subtotal: 999,
          tax_rate: 0.2,
          tax: 199.8,
          discount: 0,
          total: 1198.8,
          profit_margin: 0,
          surcharge: 0,
          notes: "Version 2 notes",
          line_items: [
            {
              name: "Version 2 item",
              description: "Version 2 description",
              quantity: 1,
              unit: "job",
              unit_price: 999,
              total: 999,
              sort_order: 0,
              category: "materials",
            },
          ],
          created_at: "2026-04-02T00:00:00.000Z",
          updated_at: "2026-04-02T00:00:00.000Z",
        },
      ],
      error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const versionOneTab = await screen.findByRole("tab", { name: /version 1/i });
    fireEvent.mouseDown(versionOneTab);
    fireEvent.click(versionOneTab);

    fireEvent.click(screen.getByRole("button", { name: /^Add$/i }));
    fireEvent.change(screen.getByPlaceholderText("Version name"), {
      target: { value: "Version 3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm version creation/i }));

    await waitFor(() => {
      expect(estimateVersionsInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Version 3",
          subtotal: 111,
          tax_rate: 0.05,
          tax: 5.55,
          discount: 3,
          total: 113.55,
          profit_margin: 11,
          surcharge: 9,
          notes: "Version 1 notes",
          line_items: [
            expect.objectContaining({
              name: "Version 1 item",
              description: "Version 1 description",
              quantity: 3,
              unit: "ea",
              unit_price: 37,
              total: 111,
              sort_order: 0,
              category: "labor",
            }),
          ],
        }),
      );
    });
  });

  it("downloads profit-adjusted values in the estimate PDF", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      status: "sent",
      subtotal: 1000,
      profit_margin: 20,
      tax_rate: 0.12,
      tax: 240,
      discount: 0,
      total: 1440,
    });
    estimateVersionsOrderMock.mockResolvedValueOnce({
      data: [
        {
          id: "ver_profit",
          name: "Profit Version",
          subtotal: 1000,
          tax_rate: 0.12,
          tax: 240,
          discount: 0,
          total: 1440,
          profit_margin: 20,
          surcharge: 0,
          notes: "Profit applied",
          line_items: [
            {
              name: "Black Mulch",
              description: "Spread and level mulch",
              quantity: 1000,
              unit: "sq ft",
              unit_price: 1,
              total: 1000,
              sort_order: 0,
              category: "materials",
            },
          ],
          created_at: "2026-04-02T00:00:00.000Z",
          updated_at: "2026-04-02T00:00:00.000Z",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const versionTab = await screen.findByRole("tab", { name: /profit version/i });
    fireEvent.mouseDown(versionTab);
    fireEvent.click(versionTab);

    const versionActionsButton = screen.getByRole("button", { name: /^version actions$/i });
    fireEvent.click(versionActionsButton);
    fireEvent.click(screen.getAllByRole("button", { name: /download pdf/i })[0]);

    await waitFor(() => {
      expect(generateEstimatePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: [
            expect.objectContaining({
              name: "Black Mulch",
              unit_price: 1.2,
              total: 1200,
            }),
          ],
          subtotal: 1200,
          taxRate: 0.12,
          tax: 240,
          discount: 0,
          total: 1440,
        }),
      );
    });
  });

  it("shows approved details collapsed and keeps download in tabs actions", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      status: "accepted",
      approved_via: "manual_signature",
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /open estimate actions menu/i })).not.toBeInTheDocument();
    const compareActionsButton = await screen.findByRole("button", { name: /compare version actions/i });
    expect(compareActionsButton).toBeInTheDocument();
    fireEvent.click(compareActionsButton);
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open approved estimate actions menu/i })).not.toBeInTheDocument();

    const approvedToggleButton = screen.getByRole("button", { name: /approved/i, expanded: false });
    expect(approvedToggleButton).toBeInTheDocument();
    expect(screen.queryByText(/manually marked as approved/i)).not.toBeInTheDocument();

  });

  it("allows manual approval without a photo", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      status: "sent",
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^manually approve$/i }));

    expect(screen.getByText(/signature photo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^approve estimate$/i }));

    await waitFor(() => {
      expect(estimateUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "accepted",
          approved_via: "manual",
        }),
      );
    });

    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("uploads an optional manual approval photo and saves its URL", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      status: "sent",
    });

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:manual-approval-photo"),
      revokeObjectURL: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^manually approve$/i }));

    const photoInput = screen.getByTestId("manual-approval-upload-input");
    const file = new File(["photo"], "signature.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });
    expect(await screen.findByAltText(/selected signature photo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^approve estimate$/i }));

    await waitFor(() => {
      expect(storageUploadMock).toHaveBeenCalledWith(
        expect.stringMatching(/^estimate-approvals\/est_1\//),
        file,
        expect.objectContaining({ contentType: "image/jpeg" }),
      );
    });

    await waitFor(() => {
      expect(estimateUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "accepted",
          approved_via: "manual_signature",
          manual_approval_photo_url: "https://example.com/manual-approval-photo.jpg",
        }),
      );
    });
  });

  it("still approves the estimate if the optional photo upload fails", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      status: "sent",
    });

    storageUploadMock.mockResolvedValueOnce({ error: new Error("storage failed") });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^manually approve$/i }));
    const photoInput = screen.getByTestId("manual-approval-upload-input");
    const file = new File(["photo"], "signature.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^approve estimate$/i }));

    await waitFor(() => {
      expect(estimateUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "accepted",
          approved_via: "manual",
          manual_approval_photo_url: null,
        }),
      );
    });
  });

  it("uses the shared approve flow for pending change orders on accepted estimates", async () => {
    mockEstimate = buildEstimate({
      status: "accepted",
      has_pending_changes: true,
      approved_via: "customer_link",
      accepted_at: "2026-03-20T12:00:00.000Z",
      line_items: [
        ...buildEstimate().line_items,
        {
          id: "line_change_1",
          name: "Added retaining wall blocks",
          description: "Additional scope requested on site.",
          category: "materials",
          quantity: 1,
          unit: "job",
          unit_price: 400,
          total: 400,
          sort_order: 5,
          is_change_order: true,
          change_order_type: "added",
          change_order_approved: false,
          changed_at: "2026-03-31T14:00:00.000Z",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^manually approve$/i }));

    expect(screen.getByRole("heading", { name: /approve changes/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^approve changes$/i }));

    await waitFor(() => {
      expect(lineItemUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          change_order_approved: true,
        }),
      );
    });

    await waitFor(() => {
      expect(estimateUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          approved_via: "manual",
          accepted_at: expect.any(String),
        }),
      );
    });

    expect(estimateUpdateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
      }),
    );
  });

  it("saves manual approval photo while approving pending change orders", async () => {
    mockEstimate = buildEstimate({
      status: "accepted",
      has_pending_changes: true,
      approved_via: "customer_link",
    });

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:change-order-approval-photo"),
      revokeObjectURL: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^manually approve$/i }));
    const photoInput = screen.getByTestId("manual-approval-upload-input");
    const file = new File(["photo"], "change-order-signature.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^approve changes$/i }));

    await waitFor(() => {
      expect(storageUploadMock).toHaveBeenCalledWith(
        expect.stringMatching(/^estimate-approvals\/est_1\//),
        file,
        expect.objectContaining({ contentType: "image/jpeg" }),
      );
    });

    await waitFor(() => {
      expect(estimateUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          approved_via: "manual_signature",
          manual_approval_photo_url: "https://example.com/manual-approval-photo.jpg",
        }),
      );
    });
  });

  it("still approves estimate when photo URL column is unavailable", async () => {
    mockEstimate = buildEstimate({
      has_pending_changes: false,
      status: "sent",
    });

    const missingColumnError = {
      code: "PGRST204",
      message: "Could not find the 'manual_approval_photo_url' column of 'estimates' in the schema cache",
    };

    estimateUpdateMock
      .mockImplementationOnce(() => ({
        eq: vi.fn().mockResolvedValue({ error: missingColumnError }),
      }))
      .mockImplementationOnce(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }));

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^manually approve$/i }));
    const photoInput = screen.getByTestId("manual-approval-upload-input");
    const file = new File(["photo"], "signature.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^approve estimate$/i }));

    await waitFor(() => {
      expect(estimateUpdateMock).toHaveBeenCalledTimes(2);
    });

    expect(estimateUpdateMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        status: "accepted",
        approved_via: "manual_signature",
        manual_approval_photo_url: "https://example.com/manual-approval-photo.jpg",
      }),
    );
    expect(estimateUpdateMock.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        status: "accepted",
        approved_via: "manual_signature",
      }),
    );
    expect(estimateUpdateMock.mock.calls[1][0]).not.toHaveProperty("manual_approval_photo_url");
  });

  it("still approves pending changes when photo URL column is unavailable", async () => {
    mockEstimate = buildEstimate({
      status: "accepted",
      has_pending_changes: true,
      approved_via: "customer_link",
    });

    const missingColumnError = {
      code: "PGRST204",
      message: "Could not find the 'manual_approval_photo_url' column of 'estimates' in the schema cache",
    };

    estimateUpdateMock
      .mockImplementationOnce(() => ({
        eq: vi.fn().mockResolvedValue({ error: missingColumnError }),
      }))
      .mockImplementationOnce(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }));

    render(
      <MemoryRouter initialEntries={["/payments/estimates/est_1"]}>
        <Routes>
          <Route path="/payments/estimates/:id" element={<EstimateDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^manually approve$/i }));
    const photoInput = screen.getByTestId("manual-approval-upload-input");
    const file = new File(["photo"], "change-order-signature.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^approve changes$/i }));

    await waitFor(() => {
      expect(lineItemUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          change_order_approved: true,
        }),
      );
    });

    await waitFor(() => {
      expect(estimateUpdateMock).toHaveBeenCalledTimes(2);
    });

    expect(estimateUpdateMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        approved_via: "manual_signature",
        manual_approval_photo_url: "https://example.com/manual-approval-photo.jpg",
      }),
    );
    expect(estimateUpdateMock.mock.calls[0][0]).not.toHaveProperty("status");
    expect(estimateUpdateMock.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        approved_via: "manual_signature",
      }),
    );
    expect(estimateUpdateMock.mock.calls[1][0]).not.toHaveProperty("manual_approval_photo_url");
    expect(estimateUpdateMock.mock.calls[1][0]).not.toHaveProperty("status");
  });
});
