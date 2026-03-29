# Line Item Description Expand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clamp compact line item descriptions to three lines by default and provide an inline "View more" toggle that expands only the chosen description while keeping the edit/delete row aligned.

**Architecture:** Build on the existing `EditEstimateModal` structure by tracking per-line-item expansion keys in component state, passing down `isDescriptionExpanded`/`onToggleDescription` props to `CompactLineItem`, and letting the description area drop the clamp when expanded. UI tweaks stay localized to the compact card so the modal layout is unaffected.

**Tech Stack:** React + TypeScript, Tailwind/Tachyons-style utility classes, Vitest + Testing Library for component tests.

---

### Task 1: Add description toggle state and pass props

**Files:**
- Modify: `src/components/payments/EditEstimateModal.tsx:40-130`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompactLineItem } from "@/components/payments/EditEstimateModal";
import { LineItemForm } from "@/components/payments/EditEstimateModal";

test("View more toggle calls handler and switches label", async () => {
  const item: LineItemForm = {
    id: "test",
    name: "Service",
    description: "A long description that should trigger the toggle because it exceeds the length threshold.",
    quantity: "1",
    unit_price: "2000",
    unit: "ea",
    category: "other",
  };
  const onToggleDescription = vi.fn();
  render(
    <CompactLineItem
      item={item}
      index={0}
      pendingDelete={false}
      onExpand={() => {}}
      onRemove={() => {}}
      onUndoRemove={() => {}}
      isDescriptionExpanded={false}
      onToggleDescription={onToggleDescription}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: /view more/i }));
  expect(onToggleDescription).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/test/lineItemDescriptionExpand.test.tsx`

Expected: FAIL because `CompactLineItem` does not yet export `isDescriptionExpanded`/`onToggleDescription` props or render a `View more` button.

- [ ] **Step 3: Write minimal implementation**

1. Export `CompactLineItem` and `LineItemForm` so tests can import them.
2. Add `useState<Set<string>>` (or `string[]`) in `EditEstimateModal` to track expanded keys based on `item.id` or `new-${index}` fallback. Provide `isDescriptionExpanded` and `onToggleDescription` props when rendering each `CompactLineItem`.
3. Update `CompactLineItem` props to accept the new boolean and handler, render a `button` with label toggling between "View more"/"View less" when the description length is over the ~180-character threshold, and apply `line-clamp-3 break-words` only when `isDescriptionExpanded` is false so the text gets truncated; drop the clamp when expanded so the card height can grow.
4. Keep the edit/delete buttons aligned with the title row as described in the spec.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/test/lineItemDescriptionExpand.test.tsx`

Expected: PASS because the component now exports the necessary props and renders the toggle.

- [ ] **Step 5: Commit**

```bash
git add src/components/payments/EditEstimateModal.tsx src/test/lineItemDescriptionExpand.test.tsx
git commit -m "feat: add view more toggle for estimate line item" 
```
