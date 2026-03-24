import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { CSVImportModal } from "@/components/leads/CSVImportModal";

const { insertMock, findOrCreateCustomerMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  insertMock: vi.fn().mockResolvedValue({ error: null }),
  findOrCreateCustomerMock: vi.fn().mockResolvedValue({ id: "cust_1" }),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        return {
          insert: insertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  },
}));

vi.mock("@/lib/findOrCreateCustomer", () => ({
  findOrCreateCustomer: findOrCreateCustomerMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select aria-label={value || "select"} value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>
      {typeof children === "string" ? children : "option"}
    </option>
  ),
}));

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsText(file: File) {
    this.result = `Name,Status\nTaylor Smith,Won\nJordan Lee,In Progress`;
    this.onload?.({ target: { result: this.result as string } });
  }
}

describe("CSVImportModal", () => {
  beforeEach(() => {
    insertMock.mockClear();
    findOrCreateCustomerMock.mockClear();
    toastErrorMock.mockClear();
    toastSuccessMock.mockClear();
    // @ts-expect-error test shim
    global.FileReader = MockFileReader;
  });

  it("adds a status mapping step after column mapping and imports with the mapped statuses", async () => {
    const onImportComplete = vi.fn();

    render(<CSVImportModal open onOpenChange={() => {}} onImportComplete={onImportComplete} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["Name,Status\nTaylor Smith,Won"], "leads.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText("Map CSV Columns");

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "status" } });

    fireEvent.click(screen.getByRole("button", { name: /Continue to Status Matching/i }));

    await screen.findByText("Match Status Values");
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();

    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.change(statusSelects[0], { target: { value: "qualified" } });
    fireEvent.change(statusSelects[1], { target: { value: "job" } });

    fireEvent.click(screen.getByRole("button", { name: /Import 2 Leads/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          name: "Taylor Smith",
          status: "qualified",
        }),
      );
      expect(insertMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          name: "Jordan Lee",
          status: "job",
        }),
      );
    });
  });
});
