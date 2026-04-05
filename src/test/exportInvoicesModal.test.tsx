import { fireEvent, render, screen } from "@testing-library/react";
import { createContext, useContext } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ExportInvoicesModal } from "@/components/payments/ExportInvoicesModal";

const mockUseGenerateExport = vi.fn();
const mockUseFinancialExportHistory = vi.fn();

vi.mock("@/hooks/useFinancialExports", () => ({
  useGenerateExport: () => mockUseGenerateExport(),
  useFinancialExportHistory: () => mockUseFinancialExportHistory(),
}));

const SelectContext = createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>,
  SelectTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => {
    const { value } = useContext(SelectContext);
    return <span>{value ?? placeholder ?? ""}</span>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      <button type="button" onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
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
      screen.getByText((content) =>
        content.includes("Last export: Mar 21, 2026 at") &&
        content.includes("for Mar 1 - Mar 20, 2026")
      )
    ).toBeInTheDocument();
  });

  it("exports to QuickBooks when quickbooks destination is selected", () => {
    const mutate = vi.fn();
    mockUseGenerateExport.mockReturnValue({
      mutate,
      isPending: false,
    });
    mockUseFinancialExportHistory.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<ExportInvoicesModal open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Destination" }));
    fireEvent.click(screen.getByRole("button", { name: "QuickBooks (Payments)" }));
    fireEvent.click(screen.getByRole("button", { name: "Export to QuickBooks" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        exportTarget: "quickbooks",
      }),
      expect.any(Object)
    );
  });

  it("uses dropdown controls for destination and timeline", () => {
    mockUseGenerateExport.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseFinancialExportHistory.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<ExportInvoicesModal open onOpenChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Destination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toBeInTheDocument();
  });

  it("renders export includes without outlined card styling", () => {
    mockUseGenerateExport.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseFinancialExportHistory.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<ExportInvoicesModal open onOpenChange={() => {}} />);

    const exportIncludes = screen.getByText("Export includes:").closest("div");
    expect(exportIncludes).not.toBeNull();
    expect(exportIncludes?.className).not.toContain("border");
  });
});
