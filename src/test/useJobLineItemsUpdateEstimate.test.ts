import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  useQueryMock,
  useMutationMock,
  invalidateQueriesMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
}));

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

const {
  fromMock,
  estimateLineItemsUpdateMock,
  estimateLineItemsMarkDeletedInMock,
  estimateLineItemsInsertMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  estimateLineItemsUpdateMock: vi.fn(),
  estimateLineItemsMarkDeletedInMock: vi.fn(),
  estimateLineItemsInsertMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useJobLineItems } from "@/hooks/useJobLineItems";

function createMaybeSingleQuery<T>(result: T) {
  const query: any = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return query;
}

function createAwaitableQuery<T>(result: T) {
  const query: any = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    or: vi.fn(() => query),
    then: (onFulfilled: (value: T) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return query;
}

describe("useJobLineItems updateEstimateFromJobCosts", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    invalidateQueriesMock.mockReset();
    useAuthMock.mockReset();
    fromMock.mockReset();
    estimateLineItemsUpdateMock.mockReset();
    estimateLineItemsMarkDeletedInMock.mockReset();
    estimateLineItemsInsertMock.mockReset();

    useAuthMock.mockReturnValue({
      currentAccount: { id: "acct_1" },
    });

    useQueryMock.mockImplementation(({ queryKey }: any) => {
      if (queryKey?.[0] === "job-line-items") return { data: [], isLoading: false };
      if (queryKey?.[0] === "job-costs-approved-estimate") return { data: true };
      return { data: undefined, isLoading: false };
    });

    useMutationMock.mockImplementation((config: any) => ({
      mutate: vi.fn(),
      mutateAsync: async (variables: any) => {
        const data = await config.mutationFn(variables);
        config.onSuccess?.(data, variables);
        return data;
      },
      isPending: false,
    }));

    estimateLineItemsMarkDeletedInMock.mockResolvedValue({ error: null });
    estimateLineItemsUpdateMock.mockReturnValue({
      in: estimateLineItemsMarkDeletedInMock,
    });

    estimateLineItemsInsertMock.mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "estimates") {
        return {
          select: vi.fn(() =>
            createMaybeSingleQuery({
              data: {
                id: "est_1",
                tax_rate: 0,
                discount: 0,
                profit_margin: 0,
                surcharge: 0,
              },
              error: null,
            }),
          ),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          })),
        };
      }

      if (table === "job_line_items") {
        return {
          select: vi.fn(() =>
            createAwaitableQuery({
              data: [
                {
                  name: "Crew Hours",
                  description: null,
                  quantity: 2,
                  unit: "hr",
                  unit_price: 100,
                  total: 200,
                  category: "labor",
                },
              ],
              error: null,
            }),
          ),
        };
      }

      if (table === "estimate_line_items") {
        return {
          select: vi.fn((columns: string) => {
            if (columns === "id") {
              return createAwaitableQuery({
                data: [{ id: "base_material_1" }],
                error: null,
              });
            }
            if (columns === "sort_order") {
              return createAwaitableQuery({
                data: [{ sort_order: 3 }],
                error: null,
              });
            }
            if (columns === "total") {
              return createAwaitableQuery({
                data: [{ total: 100 }, { total: 200 }],
                error: null,
              });
            }
            throw new Error(`Unexpected estimate_line_items select columns: ${columns}`);
          }),
          update: estimateLineItemsUpdateMock,
          insert: estimateLineItemsInsertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("replace marks existing section items as deleted change orders when no matching job costs exist", async () => {
    const hook = useJobLineItems("job_1");

    await expect(
      hook.updateEstimateFromJobCosts.mutateAsync({ mode: "replace", target: "materials" }),
    ).resolves.toBeUndefined();

    expect(estimateLineItemsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        is_change_order: true,
        change_order_type: "deleted",
        change_order_approved: false,
      }),
    );
    expect(estimateLineItemsMarkDeletedInMock).toHaveBeenCalledWith("id", ["base_material_1"]);
    expect(estimateLineItemsInsertMock).not.toHaveBeenCalled();
  });

  it("add_to appends new items as added change orders and does not delete existing section", async () => {
    const hook = useJobLineItems("job_1");

    await expect(
      hook.updateEstimateFromJobCosts.mutateAsync({ mode: "add_to", target: "labor" }),
    ).resolves.toBeUndefined();

    expect(estimateLineItemsUpdateMock).not.toHaveBeenCalled();
    expect(estimateLineItemsInsertMock).toHaveBeenCalledTimes(1);
    expect(estimateLineItemsInsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          is_change_order: true,
          change_order_type: "added",
          change_order_approved: false,
          name: "Crew Hours",
          category: "labor",
        }),
      ]),
    );
  });
});
