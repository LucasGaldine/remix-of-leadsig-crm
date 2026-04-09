import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditEstimateModal } from "@/components/payments/EditEstimateModal";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      insert: async () => ({ error: null }),
      select: () => ({
        eq: () => ({
          or: async () => ({ data: [] }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({
    className,
    children,
  }: {
    className?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="edit-estimate-dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/leads/QuickAddLineItem", () => ({
  QuickAddLineItem: ({
    onApply,
  }: {
    templates: any[];
    onApply: (template: any) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onApply({
          name: "Concrete Service",
          description: "",
          quantity: "",
          unit: "sq ft",
          unit_price: "125.50",
          category: "other",
        })
      }
    >
      Quick Add
    </button>
  ),
}));

describe("EditEstimateModal responsive width", () => {
  it("applies a mobile-safe max width with desktop override", () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={{
          id: "est_1",
          account_id: "acct_1",
          job_id: "job_1",
          tax_rate: 0.08,
          discount: 0,
          status: "draft",
          line_items: [
            {
              id: "item_1",
              name: "Labor",
              description: "Demo",
              quantity: 1,
              unit: "each",
              unit_price: 100,
              category: "labor",
              is_change_order: false,
              change_order_type: null,
            },
          ],
        }}
      />
    );

    const content = screen.getByTestId("edit-estimate-dialog-content");
    expect(content).toHaveClass("max-w-[calc(100dvw-1rem)]");
    expect(content).toHaveClass("sm:max-w-2xl");
  });

  it("applies quick add values without wiping an existing description", () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={{
          id: "est_1",
          account_id: "acct_1",
          job_id: "job_1",
          tax_rate: 0.08,
          discount: 0,
          status: "draft",
          line_items: [
            {
              id: "item_1",
              name: "Labor",
              description: "Demo",
              quantity: 1,
              unit: "each",
              unit_price: 100,
              category: "labor",
              is_change_order: false,
              change_order_type: null,
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Keep this description" },
    });

    fireEvent.click(screen.getByRole("button", { name: /quick add/i }));

    expect(screen.getByLabelText(/title/i)).toHaveValue("Concrete Service");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Keep this description");
  });
});
