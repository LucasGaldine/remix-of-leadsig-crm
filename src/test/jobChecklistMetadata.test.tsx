import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createContext, useContext } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobChecklist } from "@/components/jobs/JobChecklist";
import type { ChecklistItem } from "@/hooks/useJobChecklist";

const checklistState = {
  items: [] as ChecklistItem[],
};

const toggleMutateAsyncMock = vi.fn();
const addMutateAsyncMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const deleteMutateAsyncMock = vi.fn();

vi.mock("@/hooks/useJobChecklist", () => ({
  getChecklistItemCategory: (metadata: { category?: string } | null | undefined) => {
    const category = metadata?.category;
    if (category === "task" || category === "tool" || category === "material") {
      return category;
    }
    return "standard";
  },
  useJobChecklist: () => ({
    items: checklistState.items,
    isLoading: false,
    toggleItem: { mutateAsync: toggleMutateAsyncMock },
    addItem: { mutateAsync: addMutateAsyncMock },
    updateItem: { mutateAsync: updateMutateAsyncMock },
    deleteItem: { mutateAsync: deleteMutateAsyncMock },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const SelectContext = createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <SelectContext.Provider value={{ value, onValueChange }}>
      {children}
    </SelectContext.Provider>
  ),
  SelectTrigger: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => {
    const { value } = useContext(SelectContext);
    return <span>{value || placeholder || ""}</span>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: ReactNode;
  }) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      <button type="button" onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

describe("JobChecklist metadata categories", () => {
  beforeEach(() => {
    checklistState.items = [];
    toggleMutateAsyncMock.mockReset();
    addMutateAsyncMock.mockReset();
    updateMutateAsyncMock.mockReset();
    deleteMutateAsyncMock.mockReset();
  });

  it("renders separate Tasks, Tools, and Materials sections and keeps legacy/null items in Tasks without task badges or inner cards", () => {
    checklistState.items = [
      {
        id: "legacy",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Knock and announce arrival",
        is_completed: false,
        sort_order: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: null,
      },
      {
        id: "tool",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Hedge trimmer",
        is_completed: false,
        sort_order: 1,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "tool" },
      },
      {
        id: "material",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Mulch",
        is_completed: false,
        sort_order: 2,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "material" },
      },
    ];

    render(<JobChecklist jobId="job_1" isManager={false} />);

    const tasksSection = screen.getByRole("region", { name: "Tasks" });
    const toolsSection = screen.getByRole("region", { name: "Tools" });
    const materialsSection = screen.getByRole("region", { name: "Materials" });

    expect(within(tasksSection).getByText("Knock and announce arrival")).toBeInTheDocument();
    expect(within(toolsSection).getByText("Hedge trimmer")).toBeInTheDocument();
    expect(within(materialsSection).getByText("Mulch")).toBeInTheDocument();

    expect(screen.getByText("Tool")).toBeInTheDocument();
    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(within(tasksSection).queryByText("Task")).not.toBeInTheDocument();

    expect(tasksSection.querySelector(".rounded-md.border.border-border.bg-card")).toBeNull();
    expect(toolsSection.querySelector(".rounded-md.border.border-border.bg-card")).toBeNull();
    expect(materialsSection.querySelector(".rounded-md.border.border-border.bg-card")).toBeNull();
  });

  it("shows a single footer add-task control in edit mode and persists non-standard metadata", async () => {
    checklistState.items = [
      {
        id: "existing",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Legacy item",
        is_completed: false,
        sort_order: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: null,
      },
    ];

    render(<JobChecklist jobId="job_1" isManager />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.queryByRole("button", { name: /add task checklist item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add tool checklist item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add material checklist item/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^add task$/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /^add task$/i }));

    expect(screen.getByText("Add Checklist Item")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^standard$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new checklist item category/i }));
    fireEvent.click(screen.getByRole("button", { name: /^tool$/i }));
    fireEvent.change(screen.getByLabelText(/item label/i), {
      target: { value: "Pole saw" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /add checklist item/i }));
    });

    expect(addMutateAsyncMock).toHaveBeenCalledWith({
      label: "Pole saw",
      sort_order: 1,
      metadata: { category: "tool" },
    });
  });

  it("opens an edit modal and updates category metadata without exposing standard", async () => {
    checklistState.items = [
      {
        id: "item-1",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Bring supplies",
        is_completed: false,
        sort_order: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "standard" },
      },
    ];

    render(<JobChecklist jobId="job_1" isManager />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit checklist item bring supplies/i }));

    expect(screen.getByText("Edit Checklist Item")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^standard$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^checklist item category$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^material$/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save checklist item/i }));
    });

    expect(updateMutateAsyncMock).toHaveBeenCalledWith({
      id: "item-1",
      label: "Bring supplies",
      metadata: { category: "material" },
    });
  });
});
