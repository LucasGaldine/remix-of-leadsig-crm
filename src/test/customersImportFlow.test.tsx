import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Customers from "@/pages/Customers";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/customers/CustomerCard", () => ({
  CustomerCard: () => null,
}));

vi.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCreateCustomer: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1" },
  }),
}));

describe("Customers import flow", () => {
  it("keeps the CSV modal open when selecting Import from CSV inside Add Customer", async () => {
    render(
      <MemoryRouter>
        <Customers />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add customer/i }));
    fireEvent.click(screen.getByRole("button", { name: /import from csv/i }));

    expect(await screen.findByText("Import Customers from CSV")).toBeInTheDocument();
  });
});
