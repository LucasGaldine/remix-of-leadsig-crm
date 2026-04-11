import { beforeEach, describe, expect, it, vi } from "vitest";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { useCostVsQuoted } from "@/hooks/useDashboardVisuals";

function createAwaitableQuery<T>(result: T) {
  const query: any = {
    eq: vi.fn(() => query),
    not: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (onFulfilled: (value: T) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return query;
}

describe("useCostVsQuoted", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useAuthMock.mockReset();
    fromMock.mockReset();

    useAuthMock.mockReturnValue({
      currentAccount: { id: "acct_1" },
    });
  });

  it("computes quoted from estimate card totals and actual from job line item totals", async () => {
    let capturedConfig: any;

    useQueryMock.mockImplementation((config: any) => {
      capturedConfig = config;
      return { data: [], isLoading: false };
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() =>
            createAwaitableQuery({
              data: [
                {
                  id: "lead_1",
                  customer_id: "cust_1",
                  name: "Acme Lawn",
                  estimated_value: 999,
                  actual_value: 999,
                  estimates: [
                    {
                      id: "est_1",
                      status: "draft",
                      total: 2600,
                      updated_at: "2026-04-03T10:00:00.000Z",
                      created_at: "2026-04-03T10:00:00.000Z",
                      versions: [{ total: 1800 }, { total: 1500 }, { total: 2100 }],
                    },
                  ],
                },
              ],
              error: null,
            }),
          ),
        };
      }

      if (table === "job_line_items") {
        return {
          select: vi.fn(() =>
            createAwaitableQuery({
              data: [
                { lead_id: "lead_1", category: "labor", total: 300 },
                { lead_id: "lead_1", category: "materials", total: 250 },
                { lead_id: "lead_1", category: "equipment", total: 150 },
              ],
              error: null,
            }),
          ),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    useCostVsQuoted("week");

    const rows = await capturedConfig.queryFn();

    expect(rows).toEqual([
      {
        id: "lead_1",
        customerId: "cust_1",
        name: "Acme Lawn",
        quoted: 1500,
        actual: 700,
      },
    ]);
  });
});
