# Estimate Detail Two-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the estimate view page to match the two-column detail layout used by Job/Lead pages while making Approve, Client Portal, and Download PDF visible quick action buttons.

**Architecture:** Keep existing EstimateDetail business logic and card content, but recompose the page into a responsive grid shell (`3fr/1fr` desktop, stacked mobile). Move action controls into a right-column quick actions card and place line items/notes in left column, with customer/job/invoices in right column.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Tailwind/shadcn UI.

---

### Task 1: Add failing test for required layout and quick actions

**Files:**
- Create: `src/test/estimateDetailLayout.test.tsx`
- Test: `src/test/estimateDetailLayout.test.tsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- src/test/estimateDetailLayout.test.tsx`
Expected: FAIL because current estimate detail layout has no two-column test ids and quick actions are not in right-column card.
- [ ] **Step 3: Commit**
```bash
git add src/test/estimateDetailLayout.test.tsx
git commit -m "test: cover estimate detail two-column layout and quick actions"
```

### Task 2: Refactor EstimateDetail page structure

**Files:**
- Modify: `src/pages/EstimateDetail.tsx`
- Test: `src/test/estimateDetailLayout.test.tsx`

- [ ] **Step 1: Implement minimal layout changes to satisfy test**
- [ ] **Step 2: Keep behavior parity**
Actions retain existing handlers (`handleManualApprove`, `handleGeneratePortalLink`, `handleDownloadPDF`), with existing status-based enable/disable behavior.
- [ ] **Step 3: Run targeted tests**
Run: `npm test -- src/test/estimateDetailLayout.test.tsx`
Expected: PASS
- [ ] **Step 4: Run regression checks for adjacent detail pages**
Run: `npm test -- src/test/jobDetailStatusGuidance.test.tsx src/test/leadDetailStatusGuidance.test.tsx`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add src/pages/EstimateDetail.tsx src/test/estimateDetailLayout.test.tsx
git commit -m "refactor: align estimate detail to two-column detail layout"
```
