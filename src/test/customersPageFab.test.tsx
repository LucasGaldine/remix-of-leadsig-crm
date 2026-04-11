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
  }),
}));

describe("Customers page FAB", () => {
  it("shows the main actions menu with add lead and add job", async () => {
    render(
      <MemoryRouter>
        <Customers />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

    expect(screen.getByRole("button", { name: /add lead/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add job/i })).toBeInTheDocument();
  });
});
