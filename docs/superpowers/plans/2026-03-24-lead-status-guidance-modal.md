# Lead Status Guidance Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the lead detail header status badge open an informational modal that explains how each lead-only status stage is reached.

**Architecture:** Keep the feature local to `src/pages/LeadDetail.tsx` by adding a small status-guidance data structure, a dialog open state, and an interactive badge trigger. Verify the behavior with a focused page-level UI test so the dialog contract stays stable without changing shared badge behavior.

**Tech Stack:** React, TypeScript, React Testing Library, Vitest, existing Radix-based dialog primitives

---

### Task 1: Add a focused UI test for the status guidance dialog

**Files:**
- Modify: `src/test`
- Test: `src/test/leadDetailStatusGuidance.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/test/leadDetailStatusGuidance.test.tsx` with a test that renders `LeadDetail`, opens the header status badge trigger, and asserts that the dialog shows `New`, `Contacted`, `Qualified`, and `Lost` while excluding `Job`, `Scheduled`, and `In Progress`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/leadDetailStatusGuidance.test.tsx`
Expected: FAIL because the lead detail page does not yet expose the interactive trigger and dialog content.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/LeadDetail.tsx`:
- add a local status-guidance config for the lead-only stages
- add dialog open state
- wrap the existing header `StatusBadge` in a button
- render a `Dialog` with title, description, and one row per lead status guidance item

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/leadDetailStatusGuidance.test.tsx`
Expected: PASS

- [ ] **Step 5: Run related verification**

Run: `npm test -- --runInBand`
Expected: Existing relevant tests remain green, or any unrelated failures are identified explicitly.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LeadDetail.tsx src/test/leadDetailStatusGuidance.test.tsx docs/superpowers/specs/2026-03-24-lead-status-guidance-design.md docs/superpowers/plans/2026-03-24-lead-status-guidance-modal.md
git commit -m "feat: add lead status guidance modal"
```
