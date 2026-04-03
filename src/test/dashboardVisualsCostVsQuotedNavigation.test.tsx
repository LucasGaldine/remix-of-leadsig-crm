import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardVisuals } from "@/components/dashboard/DashboardVisuals";

const navigateMock = vi.fn();
const useRevenueExpensesMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  CartesianGrid: () => <div />,
}));

vi.mock("@/hooks/useDashboardVisuals", () => ({
  useRevenueExpenses: (...args: unknown[]) => useRevenueExpensesMock(...args),
  useLeadFunnel: () => ({ data: [], isLoading: false }),
  useJobCompletion: () => ({ data: [], isLoading: false }),
  usePlannedVsActual: () => ({ data: [], isLoading: false }),
  useCostVsQuoted: () => ({
    data: [{ id: "lead_1", customerId: "cust_1", name: "Acme Lawn", quoted: 1200, actual: 950 }],
    isLoading: false,
  }),
  useCrewHours: () => ({ data: [], isLoading: false }),
}));

describe("DashboardVisuals cost vs quoted navigation", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useRevenueExpensesMock.mockReset();
    useRevenueExpensesMock.mockReturnValue({ data: [], isLoading: false });
  });

  it("navigates to the related customer detail when a cost card row is clicked", () => {
    render(<DashboardVisuals />);

    fireEvent.click(screen.getByRole("button", { name: /open client acme lawn/i }));

    expect(navigateMock).toHaveBeenCalledWith("/customers/cust_1");
  });

  it("opens one combined revenue-and-cost modal from the card and shows labeled total profit", () => {
    useRevenueExpensesMock.mockReturnValue({
      data: [
        {
          week: "Mar 4",
          revenue: 2800,
          expenses: 1200,
          revenueJobs: [{ id: "lead_1", name: "Maple St", amount: 2800 }],
          expenseJobs: [{ id: "lead_1", name: "Maple St", amount: 1200 }],
        },
        {
          week: "Mar 11",
          revenue: 1900,
          expenses: 600,
          revenueJobs: [{ id: "lead_r2", name: "Birch Ln", amount: 1900 }],
          expenseJobs: [{ id: "lead_e2", name: "Pine Dr", amount: 600 }],
        },
      ],
      isLoading: false,
    });

    render(<DashboardVisuals />);

    expect(screen.queryByRole("button", { name: /show revenue jobs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show expense jobs/i })).not.toBeInTheDocument();

    expect(screen.getByText(/total profit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open revenue and cost job details/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/revenue and costs by job/i)).toBeInTheDocument();
    expect(screen.getByText("Week of Mar 4")).toBeInTheDocument();
    expect(screen.getByText("Week of Mar 11")).toBeInTheDocument();
    expect(screen.getByText("Maple St")).toBeInTheDocument();
    expect(screen.getByText(/revenue \$2,800 \| costs \$1,200/i)).toBeInTheDocument();
    expect(screen.getByText("Birch Ln")).toBeInTheDocument();
    expect(screen.getByText("Pine Dr")).toBeInTheDocument();
  });
});
