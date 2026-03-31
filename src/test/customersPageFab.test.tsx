import { render, screen } from "@testing-library/react";
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
  }),
}));

describe("Customers page FAB", () => {
  it("shows a single add customer FAB without the intermediary action menu", async () => {
    render(
      <MemoryRouter>
        <Customers />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /add customer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open menu/i })).not.toBeInTheDocument();
  });
});
