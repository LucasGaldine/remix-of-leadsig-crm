import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LineItemsEstimateDialog } from "@/components/leads/LineItemsEstimateDialog";

const {
  invalidateQueriesMock,
  onOpenChangeMock,
  onSuccessMock,
  editorPropsRef,
} = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
  onSuccessMock: vi.fn(),
  editorPropsRef: { current: null as any },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: {
      id: "acct_1",
      default_profit_margin: 20,
      default_surcharge: 5,
      default_tax_rate: 8,
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/findOrCreateCustomer", () => ({
  findOrCreateCustomer: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/leads/EstimateLineItemsEditor", () => ({
  EstimateLineItemsEditor: (props: any) => {
    editorPropsRef.current = props;

    return (
      <div>
        <div data-testid="line-item-name">{props.lineItems?.[0]?.name || ""}</div>
        <div data-testid="profit-margin">{props.profitMargin}</div>
        <div data-testid="surcharge">{props.surcharge}</div>
      </div>
    );
  },
}));

vi.mock("@/components/voice/VoiceIntakePanel", () => ({
  VoiceIntakePanel: ({ onApply }: { onApply: (parsed: any) => void }) => (
    <button
      type="button"
      onClick={() =>
        onApply({
          lineItems: [
            {
              name: "Roof Wash",
              description: "Full roof wash",
              quantity: 1,
              unit: "each",
              unitPrice: 900,
            },
          ],
          taxRate: 9,
          discount: 100,
        })
      }
    >
      Apply Mock Voice
    </button>
  ),
}));

describe("LineItemsEstimateDialog voice estimate intake", () => {
  it("applies voice estimate values in the create estimate modal", () => {
    render(
      <LineItemsEstimateDialog
        open
        onOpenChange={onOpenChangeMock}
        onSuccess={onSuccessMock}
        lead={{
          id: "lead_1",
          name: "Alex Homeowner",
          phone: "5551112222",
          email: "alex@example.com",
          address: "123 Main St",
          city: "Austin",
          service_type: null,
          estimated_value: null,
        }}
      />,
    );

    expect(screen.getByTestId("line-item-name").textContent).toBe("");

    fireEvent.click(screen.getByRole("button", { name: /voice estimate intake/i }));
    fireEvent.click(screen.getByRole("button", { name: /apply mock voice/i }));

    expect(screen.getByTestId("line-item-name").textContent).toBe("Roof Wash");
    expect(screen.getByTestId("profit-margin").textContent).toBe("20");
    expect(screen.getByTestId("surcharge").textContent).toBe("5");

    expect(editorPropsRef.current.lineItems[0]).toMatchObject({
      name: "Roof Wash",
      description: "Full roof wash",
      quantity: "1",
      unit: "each",
      unit_price: "900",
      category: "other",
    });
  });
});
