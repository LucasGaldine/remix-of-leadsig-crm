import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditEstimateModal } from "@/components/payments/EditEstimateModal";

const updateCalls: Array<{ table: string; values: Record<string, any> }> = [];
const insertCalls: Array<Record<string, any>> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: Record<string, any>) => {
        updateCalls.push({ table, values });
        return { eq: async () => ({ error: null }) };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
      insert: async (values: Record<string, any>) => {
        insertCalls.push(values);
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          or: async () => ({ data: [] }),
        }),
      }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children, id }: any) => <div id={id}>{children}</div>,
  SelectValue: () => null,
}));

vi.mock("@/components/ui/speech-to-text-textarea", () => ({
  SpeechToTextTextarea: ({ id, value, onValueChange }: any) => (
    <textarea id={id} value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));

vi.mock("@/components/leads/QuickEstimateLineItem", () => ({
  QuickEstimateLineItem: () => null,
}));

describe("EditEstimateModal reorder-only changes", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    insertCalls.length = 0;
  });

  it("updates sort order without turning reordered items into change orders", async () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={{
          id: "est_1",
          account_id: "acct_1",
          job_id: "job_1",
          tax_rate: 0,
          discount: 0,
          profit_margin: 0,
          surcharge: 0,
          status: "accepted",
          line_items: [
            {
              id: "item_1",
              name: "Item One",
              description: "First",
              quantity: 1,
              unit: "each",
              unit_price: 100,
              total: 100,
              sort_order: 0,
              category: "labor",
              is_change_order: false,
              change_order_type: null,
            },
            {
              id: "item_2",
              name: "Item Two",
              description: "Second",
              quantity: 1,
              unit: "each",
              unit_price: 50,
              total: 50,
              sort_order: 1,
              category: "materials",
              is_change_order: false,
              change_order_type: null,
            },
          ],
        }}
      />,
    );

    fireEvent.dragStart(screen.getByLabelText(/drag item 1/i));
    fireEvent.dragOver(screen.getByLabelText(/drag item 2/i));
    fireEvent.dragEnd(screen.getByLabelText(/drag item 1/i));

    fireEvent.click(screen.getByRole("button", { name: /send change order/i }));

    const changeOrderUpdates = updateCalls.filter(
      (call) => call.table === "estimate_line_items" && call.values.change_order_type === "edited",
    );
    expect(changeOrderUpdates).toHaveLength(0);

    const sortUpdates = updateCalls.filter(
      (call) => call.table === "estimate_line_items" && Object.keys(call.values).length === 1 && "sort_order" in call.values,
    );
    expect(sortUpdates.length).toBeGreaterThanOrEqual(1);
    expect(insertCalls).toHaveLength(0);
  });
});
