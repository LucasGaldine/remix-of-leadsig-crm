# Disabled Schedule Visit Explanation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a specific explanation when the disabled `Schedule Visit` action is hovered, focused, or tapped on the lead detail page.

**Architecture:** Keep the logic in `src/pages/LeadDetail.tsx` by deriving the disabled reason from the existing `hasAddress` condition and rendering the current button inside an interactive wrapper only when blocked. Reuse the shared tooltip and popover primitives so desktop and mobile both expose the same message without changing enabled behavior.

**Tech Stack:** React, TypeScript, Radix tooltip/popover wrappers, React Testing Library, Vitest

---

### Task 1: Add a failing interaction test for the disabled explanation

**Files:**
- Modify: `src/test/leadDetailStatusGuidance.test.tsx`
- Modify: `src/pages/LeadDetail.tsx`

- [ ] **Step 1: Write the failing test**

Extend `src/test/leadDetailStatusGuidance.test.tsx` with a case that renders a lead missing address/city, interacts with the disabled `Schedule Visit` affordance, and asserts the page shows `Add an address and city to schedule a visit.`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/leadDetailStatusGuidance.test.tsx`
Expected: FAIL because the disabled CTA does not yet expose any explanation.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/LeadDetail.tsx`:
- derive a `scheduleVisitDisabledReason`
- when disabled, wrap the current `Schedule Visit` button in an interactive container
- show the disabled reason through shared tooltip and popover primitives
- keep enabled behavior unchanged

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/leadDetailStatusGuidance.test.tsx`
Expected: PASS

- [ ] **Step 5: Run related verification**

Run: `npm test -- src/test/leadDetailStatusGuidance.test.tsx src/test/detailDeleteConfig.test.ts`
Expected: Existing covered behavior remains green.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LeadDetail.tsx src/test/leadDetailStatusGuidance.test.tsx docs/superpowers/specs/2026-03-24-disabled-schedule-visit-explanation-design.md docs/superpowers/plans/2026-03-24-disabled-schedule-visit-explanation.md
git commit -m "feat: explain disabled schedule visit action"
```
