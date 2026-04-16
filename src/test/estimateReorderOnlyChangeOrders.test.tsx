import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/components/leads/QuickAddLineItem", () => ({
  QuickAddLineItem: () => null,
}));

vi.mock("@/lib/lineItemTemplates", () => ({
  migrateLegacyTemplatesToDatabase: vi.fn().mockResolvedValue(undefined),
  getLineItemTemplates: vi.fn().mockResolvedValue([]),
  upsertDedupedLineItemTemplate: vi.fn().mockResolvedValue(null),
}));

const baseEstimate = {
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
};

describe("EditEstimateModal change detection", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    insertCalls.length = 0;
  });

  it("disables the action button when nothing changed", () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={baseEstimate}
      />,
    );

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });


  it("treats approved change-order items as the new clean baseline", () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={{
          ...baseEstimate,
          has_pending_changes: false,
          line_items: [
            {
              id: "item_1",
              name: "Original Item One",
              description: "Old version",
              quantity: 1,
              unit: "each",
              unit_price: 100,
              total: 100,
              sort_order: 0,
              category: "labor",
              is_change_order: false,
              change_order_type: null,
              change_order_approved: null,
            },
            {
              id: "item_1_edit",
              original_line_item_id: "item_1",
              name: "Updated Item One",
              description: "Approved version",
              quantity: 2,
              unit: "each",
              unit_price: 125,
              total: 250,
              sort_order: 0,
              category: "labor",
              is_change_order: true,
              change_order_type: "edited",
              change_order_approved: true,
            },
            {
              id: "item_3_added",
              name: "Approved Added Item",
              description: "Already approved",
              quantity: 1,
              unit: "each",
              unit_price: 80,
              total: 80,
              sort_order: 1,
              category: "materials",
              is_change_order: true,
              change_order_type: "added",
              change_order_approved: true,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/updated item one/i)).toBeInTheDocument();
    expect(screen.getByText(/approved added item/i)).toBeInTheDocument();
    expect(screen.queryByText(/original item one/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("saves reorder-only changes without turning reordered items into change orders", async () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={baseEstimate}
      />,
    );

    fireEvent.dragStart(screen.getByLabelText(/drag item 1/i));
    fireEvent.dragOver(screen.getByLabelText(/drag item 2/i));
    fireEvent.dragEnd(screen.getByLabelText(/drag item 1/i));

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

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

  it("keeps substantive edits behind the send change order action", async () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={baseEstimate}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "" })[0]);
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Item One Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send change order/i }));

    const substantiveUpdates = updateCalls.filter(
      (call) => call.table === "estimate_line_items" && call.values.change_order_type === "edited",
    );
    expect(substantiveUpdates).toHaveLength(1);
    expect(substantiveUpdates[0].values.name).toBe("Item One Updated");

    await waitFor(() => {
      const estimatePendingUpdate = updateCalls.find(
        (call) => call.table === "estimates" && call.values.has_pending_changes === true,
      );
      expect(estimatePendingUpdate).toBeDefined();
    });
  });

  it("allows renaming the active estimate version from the editor header", async () => {
    render(
      <EditEstimateModal
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
        estimate={{ ...baseEstimate, status: "draft" }}
        versionId="ver_1"
        versionName="Version 1"
      />,
    );

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/version name/i), {
      target: { value: "Final Client Version" },
    });

    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    const versionUpdate = updateCalls.find((call) => call.table === "estimate_versions");
    expect(versionUpdate).toBeDefined();
    expect(versionUpdate?.values.name).toBe("Final Client Version");
  });
});
