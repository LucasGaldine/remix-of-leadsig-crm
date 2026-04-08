import { describe, it, expect, vi, beforeEach } from "vitest";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

const { inMock, fromMock } = vi.hoisted(() => ({
  inMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import { useLeadCounts } from "@/hooks/useLeads";

function createLeadsQueryBuilder(data: Array<{ status: string | null }>) {
  const result = { data, error: null as null | { message: string } };
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: inMock.mockImplementation(() => query),
    order: vi.fn(() => query),
    then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return query;
}

describe("useLeadCounts query safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      user: { id: "user_1" },
      currentAccount: { id: "acct_1" },
    });

    useQueryMock.mockImplementation((config: any) => config);
  });

  it("does not use a status .in filter so counts don't break on enum drift", async () => {
    fromMock.mockReturnValue(
      createLeadsQueryBuilder([
        { status: "new" },
        { status: "contacted" },
        { status: "qualified" },
        { status: "lost" },
        { status: "cancelled" },
        { status: "archived" },
      ]),
    );

    const queryConfig = useLeadCounts() as any;
    const counts = await queryConfig.queryFn();

    expect(inMock).not.toHaveBeenCalled();
    expect(counts).toEqual({
      all: 3,
      new: 1,
      contacted: 1,
      qualified: 1,
      archive: 3,
    });
  });
});
