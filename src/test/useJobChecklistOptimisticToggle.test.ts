import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useQueryMock,
  useMutationMock,
  useQueryClientMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
}));

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

const { fromMock, updateMock, eqMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: useQueryClientMock,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { useJobChecklist } from "@/hooks/useJobChecklist";

function keyToString(key: unknown) {
  return JSON.stringify(key);
}

describe("useJobChecklist toggleItem optimistic updates", () => {
  const cache = new Map<string, unknown>();

  const queryClient = {
    cancelQueries: vi.fn(async () => undefined),
    getQueryData: vi.fn((queryKey: unknown) => cache.get(keyToString(queryKey))),
    setQueryData: vi.fn((queryKey: unknown, updater: unknown) => {
      const cacheKey = keyToString(queryKey);
      const previous = cache.get(cacheKey);
      const next =
        typeof updater === "function"
          ? (updater as (current: unknown) => unknown)(previous)
          : updater;
      cache.set(cacheKey, next);
      return next;
    }),
    invalidateQueries: vi.fn(),
  };

  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useQueryClientMock.mockReset();
    useAuthMock.mockReset();
    fromMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();

    cache.clear();
    queryClient.cancelQueries.mockClear();
    queryClient.getQueryData.mockClear();
    queryClient.setQueryData.mockClear();
    queryClient.invalidateQueries.mockClear();

    useAuthMock.mockReturnValue({
      user: { id: "user_1" },
      currentAccount: { id: "acct_1" },
    });

    useQueryMock.mockReturnValue({ data: [], isLoading: false });
    useQueryClientMock.mockReturnValue(queryClient);

    useMutationMock.mockImplementation((config: any) => ({
      mutateAsync: async (variables: any) => {
        const context = await config.onMutate?.(variables);
        try {
          const data = await config.mutationFn(variables);
          config.onSuccess?.(data, variables, context);
          config.onSettled?.(data, null, variables, context);
          return data;
        } catch (error) {
          config.onError?.(error, variables, context);
          config.onSettled?.(undefined, error, variables, context);
          throw error;
        }
      },
      isPending: false,
    }));

    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockImplementation((table: string) => {
      if (table === "job_checklist_items") {
        return { update: updateMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    cache.set(
      keyToString(["job-checklist", "job_1"]),
      [
        {
          id: "item_1",
          job_id: "job_1",
          account_id: "acct_1",
          label: "Lock gate",
          is_completed: false,
          sort_order: 0,
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-01T00:00:00.000Z",
          metadata: { category: "task" },
        },
      ],
    );
  });

  it("updates checklist cache immediately before the backend responds", async () => {
    let resolveRequest: ((value: { error: null }) => void) | null = null;
    eqMock.mockReturnValue(
      new Promise<{ error: null }>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const hook = useJobChecklist("job_1");
    const mutationPromise = hook.toggleItem.mutateAsync({
      id: "item_1",
      is_completed: true,
    });

    await Promise.resolve();

    const optimisticItems = cache.get(keyToString(["job-checklist", "job_1"])) as Array<{ is_completed: boolean }>;
    expect(optimisticItems[0]?.is_completed).toBe(true);

    resolveRequest?.({ error: null });
    await mutationPromise;

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["job-checklist", "job_1"] });
  });

  it("rolls back checklist cache when the backend update fails", async () => {
    eqMock.mockResolvedValue({ error: new Error("update failed") });

    const hook = useJobChecklist("job_1");

    await expect(
      hook.toggleItem.mutateAsync({
        id: "item_1",
        is_completed: true,
      }),
    ).rejects.toThrow("update failed");

    const rolledBackItems = cache.get(keyToString(["job-checklist", "job_1"])) as Array<{ is_completed: boolean }>;
    expect(rolledBackItems[0]?.is_completed).toBe(false);
  });
});
