import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobInvoiceCard } from "@/components/jobs/JobInvoiceCard";

const navigateMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: { id: "acct_1", default_tax_rate: 0 },
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/components/payments/OtherPaymentOptionsModal", () => ({
  OtherPaymentOptionsModal: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "invoices") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [] }),
            }),
          }),
        };
      }

      if (table === "estimates") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null }),
          }),
        }),
      };
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
  },
}));

describe("JobInvoiceCard total sign", () => {
  it("prefixes the invoice total with a plus sign", () => {
    render(
      <JobInvoiceCard
        jobId="job_1"
        customerEmail="test@example.com"
        customerName="Test Customer"
        estimateTotal={500}
      />,
    );

    expect(screen.getByText(/^\+\$0\.00$/)).toBeInTheDocument();
  });
});
