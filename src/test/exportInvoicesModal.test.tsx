import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExportInvoicesModal } from "@/components/payments/ExportInvoicesModal";

const mockUseGenerateExport = vi.fn();
const mockUseFinancialExportHistory = vi.fn();

vi.mock("@/hooks/useFinancialExports", () => ({
  useGenerateExport: () => mockUseGenerateExport(),
  useFinancialExportHistory: () => mockUseFinancialExportHistory(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ExportInvoicesModal", () => {
  it("shows the most recent export timestamp and range", () => {
    mockUseGenerateExport.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseFinancialExportHistory.mockReturnValue({
      data: [
        {
          id: "exp_2",
          account_id: "acct_1",
          created_by: "user_1",
          filename: "financial-export-mar.csv",
          date_from: "2026-03-01",
          date_to: "2026-03-20",
          record_count: 18,
          export_type: "csv",
          created_at: "2026-03-21T14:15:00.000Z",
        },
      ],
      isLoading: false,
    });

    render(<ExportInvoicesModal open onOpenChange={() => {}} />);

    expect(
      screen.getByText("Last export: Mar 21, 2026 at 10:15 AM for Mar 1 - Mar 20, 2026")
    ).toBeInTheDocument();
  });
});
