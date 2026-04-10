import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LineItemsEstimateDialog } from "@/components/leads/LineItemsEstimateDialog";

const {
  supabaseFromMock,
  estimatesInsertMock,
  estimateVersionsInsertMock,
  findOrCreateCustomerMock,
  invalidateQueriesMock,
  onOpenChangeMock,
  onSuccessMock,
} = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
  estimatesInsertMock: vi.fn(),
  estimateVersionsInsertMock: vi.fn().mockResolvedValue({ error: null }),
  findOrCreateCustomerMock: vi.fn().mockResolvedValue({ id: "cust_1" }),
  invalidateQueriesMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
  onSuccessMock: vi.fn(),
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
    from: supabaseFromMock,
  },
}));

vi.mock("@/lib/findOrCreateCustomer", () => ({
  findOrCreateCustomer: (...args: unknown[]) => findOrCreateCustomerMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "loading-id"),
    dismiss: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/jobs/CreateJobEstimateStepContent", () => ({
  CreateJobEstimateStepContent: () => <div data-testid="estimate-step-content" />,
}));

describe("LineItemsEstimateDialog estimate naming", () => {
  it("creates estimates with original as the default name", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      if (table === "estimates") {
        return {
          insert: estimatesInsertMock.mockImplementation(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: "estimate_1" }, error: null }),
            })),
          })),
        };
      }

      if (table === "estimate_line_items") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "estimate_versions") {
        return {
          insert: estimateVersionsInsertMock,
        };
      }

      if (table === "interactions") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

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
          service_type: "Lawn Care",
          estimated_value: 1000,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /create estimate/i }));

    await waitFor(() => {
      expect(estimatesInsertMock).toHaveBeenCalledTimes(1);
    });

    expect(estimatesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "original",
      }),
    );
    expect(estimateVersionsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "original",
      }),
    );
  });

  it("retries estimate creation without name when the column is unavailable", async () => {
    estimatesInsertMock.mockClear();
    estimateVersionsInsertMock.mockClear();
    onSuccessMock.mockClear();

    estimatesInsertMock.mockImplementation((values: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(
          Object.prototype.hasOwnProperty.call(values, "name")
            ? {
                data: null,
                error: {
                  code: "PGRST204",
                  message:
                    "Could not find the 'name' column of 'estimates' in the schema cache",
                },
              }
            : { data: { id: "estimate_1" }, error: null },
        ),
      })),
    }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      if (table === "estimates") {
        return {
          insert: estimatesInsertMock,
        };
      }

      if (table === "estimate_line_items") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "estimate_versions") {
        return {
          insert: estimateVersionsInsertMock,
        };
      }

      if (table === "interactions") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

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
          service_type: "Lawn Care",
          estimated_value: 1000,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /create estimate/i }));

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });

    expect(estimatesInsertMock).toHaveBeenCalledTimes(2);
    expect(estimatesInsertMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "original" }),
    );
    expect(estimatesInsertMock.mock.calls[1][0]).not.toHaveProperty("name");
    expect(estimateVersionsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "original",
      }),
    );
  });
});
