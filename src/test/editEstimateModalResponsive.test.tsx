import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditEstimateModal } from "@/components/payments/EditEstimateModal";

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  value: vi.fn(),
  configurable: true,
});

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
      Use Template
    </button>
  ),
}));

vi.mock("@/lib/lineItemTemplates", () => ({
  migrateLegacyTemplatesToDatabase: vi.fn().mockResolvedValue(undefined),
  getLineItemTemplates: vi.fn().mockResolvedValue([]),
  upsertDedupedLineItemTemplate: vi.fn().mockResolvedValue(null),
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
    expect(content).toHaveClass("w-screen");
    expect(content).toHaveClass("max-w-screen");
    expect(content).toHaveClass("p-4");
    expect(content).toHaveClass("sm:w-full");
    expect(content).toHaveClass("sm:max-w-2xl");
  });

  it("shows quick add trigger with the updated label", () => {
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

    expect(screen.getByRole("button", { name: /add service or material/i })).toBeInTheDocument();
  });

  it("shows version name input when explicitly enabled outside version mode", () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        showVersionNameField
        versionName="Version 1"
        estimate={{
          id: "est_1",
          account_id: "acct_1",
          job_id: "job_1",
          tax_rate: 0.08,
          discount: 0,
          status: "draft",
          line_items: [],
        }}
      />
    );

    expect(screen.getByLabelText(/estimate version/i)).toHaveValue("Version 1");
  });
});
