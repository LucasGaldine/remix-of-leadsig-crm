import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createContext, useContext } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobChecklist } from "@/components/jobs/JobChecklist";
import type { ChecklistItem } from "@/hooks/useJobChecklist";
import type { JobLineItem } from "@/hooks/useJobLineItems";
import type { LineItemTemplate } from "@/lib/lineItemTemplates";

const checklistState = {
  items: [] as ChecklistItem[],
  lineItems: [] as JobLineItem[],
};

const toggleMutateAsyncMock = vi.fn();
const addMutateAsyncMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const deleteMutateAsyncMock = vi.fn();
const addLineItemMutateAsyncMock = vi.fn();
const updateLineItemMutateAsyncMock = vi.fn();
const deleteLineItemMutateMock = vi.fn();
const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));
const templateState = {
  templates: [] as LineItemTemplate[],
};

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

vi.mock("@/hooks/useJobLineItems", () => ({
  useJobLineItems: () => ({
    lineItems: checklistState.lineItems,
    isLoading: false,
    addLineItem: { mutateAsync: addLineItemMutateAsyncMock },
    updateLineItem: { mutateAsync: updateLineItemMutateAsyncMock },
    deleteLineItem: { mutate: deleteLineItemMutateMock },
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/lib/lineItemTemplates", () => ({
  migrateLegacyTemplatesToDatabase: vi.fn().mockResolvedValue(undefined),
  getLineItemTemplates: vi.fn(async () => templateState.templates),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
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
    addLineItemMutateAsyncMock.mockReset();
    updateLineItemMutateAsyncMock.mockReset();
    deleteLineItemMutateMock.mockReset();
    checklistState.lineItems = [];
    templateState.templates = [];
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
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
        id: "material-legacy",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Old material row",
        is_completed: false,
        sort_order: 2,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "material" },
      },
    ];
    checklistState.lineItems = [
      {
        id: "line-material-1",
        lead_id: "job_1",
        name: "Mulch",
        description: null,
        quantity: 2,
        unit: "bags",
        unit_price: 9.5,
        total: 19,
        sort_order: 0,
        account_id: "acct_1",
        estimate_line_item_id: null,
        category: "materials",
        created_at: "2026-04-01T00:00:00.000Z",
      },
    ];

    render(<JobChecklist jobId="job_1" isManager={false} />);

    const tasksSection = screen.getByRole("region", { name: "Tasks checklist" });
    const toolsSection = screen.getByRole("region", { name: "Tools checklist" });
    const materialsSection = screen.getByRole("region", { name: "Materials checklist" });

    expect(within(tasksSection).getByText("Knock and announce arrival")).toBeInTheDocument();
    expect(within(toolsSection).getByText("Hedge trimmer")).toBeInTheDocument();
    expect(within(materialsSection).getByText("Mulch")).toBeInTheDocument();

    expect(tasksSection.querySelector(".rounded-md.border.border-border.bg-card")).toBeNull();
    expect(toolsSection.querySelector(".rounded-md.border.border-border.bg-card")).toBeNull();
    expect(materialsSection.querySelector(".rounded-md.border.border-border.bg-card")).toBeNull();
  });

  it("shows a centered completion summary and hides checklist sections when the job is completed", () => {
    checklistState.items = [
      {
        id: "task-1",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Bring ladder",
        is_completed: true,
        sort_order: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "task" },
      },
      {
        id: "tool-1",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Leaf blower",
        is_completed: true,
        sort_order: 1,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "tool" },
      },
    ];

    render(<JobChecklist jobId="job_1" jobStatus="completed" isManager={false} />);

    expect(screen.getByText("This job is complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^complete$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /tasks/i })).not.toBeInTheDocument();
  });

  it("shows per-section add controls in edit mode and persists non-standard metadata", async () => {
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

    expect(screen.getAllByRole("button", { name: /^add task$/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^add tool$/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^add material$/i })).toHaveLength(1);

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

  it("uses canonical unit options when adding a material line item", async () => {
    templateState.templates = [
      {
        id: "tmpl-material",
        name: "River rock",
        description: "3/4 inch decorative",
        quantity: "2",
        unit: "linear ft",
        unit_price: "12.5",
        category: "materials",
        created_at: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "tmpl-labor",
        name: "River rock labor",
        description: "Install labor",
        quantity: "1",
        unit: "hour",
        unit_price: "80",
        category: "labor",
        created_at: "2026-04-01T00:00:00.000Z",
      },
    ];
    addLineItemMutateAsyncMock.mockResolvedValueOnce({ id: "job-line-1" });

    render(<JobChecklist jobId="job_1" isManager />);

    fireEvent.click(screen.getByRole("button", { name: /add task, tool, or material/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add material$/i }));
    fireEvent.change(screen.getByLabelText(/material name/i), {
      target: { value: "River rock" },
    });

    fireEvent.focus(screen.getByLabelText(/material name/i));
    expect(await screen.findByRole("button", { name: /river rock/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /river rock labor/i })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: /river rock/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /add checklist item/i }));
    });

    expect(addLineItemMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "River rock",
        quantity: 2,
        unit: "linear ft",
        unit_price: 12.5,
        description: "3/4 inch decorative",
      }),
    );
  });

  it("persists optional task descriptions when adding a task", async () => {
    render(<JobChecklist jobId="job_1" isManager />);

    fireEvent.click(screen.getByRole("button", { name: /add task, tool, or material/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add task$/i }));

    fireEvent.change(screen.getByLabelText(/item label/i), {
      target: { value: "Prep work area" },
    });
    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: "Cover floors and mask adjacent surfaces." },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /add checklist item/i }));
    });

    expect(addMutateAsyncMock).toHaveBeenCalledWith({
      label: "Prep work area",
      sort_order: 0,
      metadata: { category: "task", description: "Cover floors and mask adjacent surfaces." },
    });
  });

  it("loads and updates optional task descriptions when editing a task", async () => {
    checklistState.items = [
      {
        id: "task-1",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Prime walls",
        is_completed: false,
        sort_order: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "task", description: "Use stain-blocking primer." },
      },
    ];

    render(<JobChecklist jobId="job_1" isManager />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit checklist item prime walls/i }));

    expect(screen.getByLabelText(/^description$/i)).toHaveValue("Use stain-blocking primer.");

    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: "Use two coats in high-humidity areas." },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save checklist item/i }));
    });

    expect(updateMutateAsyncMock).toHaveBeenCalledWith({
      id: "task-1",
      label: "Prime walls",
      metadata: { category: "task", description: "Use two coats in high-humidity areas." },
    });
  });

  it("shows the onMarkComplete error message instead of a false success", async () => {
    checklistState.items = [
      {
        id: "task-1",
        job_id: "job_1",
        account_id: "acct_1",
        label: "Upload before photos",
        is_completed: false,
        sort_order: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        metadata: { category: "task" },
      },
    ];

    const completionError = new Error("Add at least one before photo before completing this estimate visit.");
    const onMarkComplete = vi.fn().mockRejectedValue(completionError);

    render(<JobChecklist jobId="job_1" isManager={false} onMarkComplete={onMarkComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /^complete$/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /yes, mark complete/i }));
    });

    expect(onMarkComplete).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith(completionError.message);
    expect(toastSuccessMock).not.toHaveBeenCalledWith("Job marked as complete");
  });
});
