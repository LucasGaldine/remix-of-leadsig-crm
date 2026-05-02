import React, { createContext, useContext } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobCostsModal } from "@/components/jobs/JobCostsModal";

const addLineItemMutate = vi.fn();

type SelectContextValue = {
  onValueChange?: (value: string) => void;
};

const SelectContext = createContext<SelectContextValue>({});

vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: { onValueChange?: (value: string) => void; children: React.ReactNode }) => (
    <SelectContext.Provider value={{ onValueChange }}>{children}</SelectContext.Provider>
  ),
  SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => (
    <button type="button" aria-label={id || "select"}>{children}</button>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      <button type="button" onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/hooks/useJobLineItems", () => ({
  useJobLineItems: () => ({
    lineItems: [
      {
        id: "li_1",
        name: "Mulch",
        quantity: 1,
        unit: "each",
        unit_price: 120,
        total: 120,
        sort_order: 1,
        category: "materials",
        description: null,
      },
    ],
    isLoading: false,
    totalCost: 120,
    hasApprovedEstimate: true,
    resyncFromEstimate: { mutate: vi.fn(), isPending: false },
    updateEstimateFromJobCosts: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    addLineItem: { mutate: addLineItemMutate, mutateAsync: vi.fn() },
    updateLineItem: { mutate: vi.fn() },
    deleteLineItem: { mutate: vi.fn() },
  }),
}));

vi.mock("@/components/shared/UnitSelect", () => ({
  UnitSelect: ({
    id,
    value,
    options,
    onValueChange,
  }: {
    id?: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onValueChange: (value: string) => void;
  }) => (
    <div>
      <button type="button" aria-label={id || "unit-select"}>
        {value}
      </button>
      <div>
        {options.map((option) => (
          <button key={option.value} type="button" onClick={() => onValueChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  ),
}));

describe("JobCostsModal unit select", () => {
  it("uses canonical unit options and saves the selected unit", () => {
    render(<JobCostsModal jobId="job_1" open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /add line item/i }));

    fireEvent.change(screen.getAllByPlaceholderText(/item name/i)[0], {
      target: { value: "Pea gravel" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: /linear ft/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(addLineItemMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pea gravel",
        unit: "linear ft",
      }),
    );
  });
});
