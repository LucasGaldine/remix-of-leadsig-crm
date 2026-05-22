import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { ClientSelector } from "@/components/clients/ClientSelector";
import type { CreateCustomerInput } from "@/hooks/useCustomers";

vi.mock("@/hooks/useCustomers", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCustomers")>("@/hooks/useCustomers");
  return {
    ...actual,
    useCustomers: () => ({ data: [], isLoading: false }),
  };
});

vi.mock("@/hooks/useAddressVerification", () => ({
  useAddressVerification: () => ({
    verify: vi.fn(),
    verifying: false,
    result: null,
    reset: vi.fn(),
  }),
}));

function Harness() {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newClientData, setNewClientData] = useState<CreateCustomerInput>({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });

  return (
    <ClientSelector
      selectedCustomer={selectedCustomer}
      onSelect={setSelectedCustomer}
      newClientData={newClientData}
      onNewClientDataChange={setNewClientData}
      mode={mode}
      onModeChange={setMode}
    />
  );
}

describe("ClientSelector", () => {
  it("switches to new contact on first click even when results are open", () => {
    render(<Harness />);

    fireEvent.focus(screen.getByPlaceholderText(/search contacts/i));
    expect(screen.getByText(/type to search contacts/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new contact/i }));

    expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search contacts/i)).not.toBeInTheDocument();
  });
});
