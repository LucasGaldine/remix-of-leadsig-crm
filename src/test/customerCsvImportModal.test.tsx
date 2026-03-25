import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomerCSVImportModal } from "@/components/customers/CustomerCSVImportModal";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/lib/findOrCreateCustomer", () => ({
  findOrCreateCustomer: vi.fn(),
}));

describe("CustomerCSVImportModal", () => {
  it("uses a field-mapping step after upload (without status mapping)", async () => {
    render(<CustomerCSVImportModal open onOpenChange={() => {}} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["Name,Email\nTaylor,taylor@example.com"], "customers.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText("Map CSV Columns")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.queryByText("Match Status Values")).not.toBeInTheDocument();
  });
});
