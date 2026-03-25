# Job Status Guidance Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable status badge on the job detail page that opens a modal explaining each job stage.

**Architecture:** Extend the existing `JobDetail` page with a job-specific guidance dataset and modal state, mirroring the lead detail interaction pattern. Cover the new behavior with a focused page-level test that clicks the badge and asserts the modal content.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, shadcn/ui dialog

---

### Task 1: Add regression coverage for the job status guide

**Files:**
- Create: `src/test/jobDetailStatusGuidance.test.tsx`
- Test: `src/test/jobDetailStatusGuidance.test.tsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `npm test -- src/test/jobDetailStatusGuidance.test.tsx` to verify it fails because the badge is not clickable yet**
- [ ] **Step 3: Mock the minimal `JobDetail` dependencies needed to render the header state**
- [ ] **Step 4: Re-run the targeted test until it fails for the missing modal interaction only**

### Task 2: Implement the job status guidance modal

**Files:**
- Modify: `src/pages/JobDetail.tsx`
- Test: `src/test/jobDetailStatusGuidance.test.tsx`

- [ ] **Step 1: Add a job-stage guidance constant covering unscheduled, unassigned, scheduled, completed, needs invoice, and paid**
- [ ] **Step 2: Add modal open state and make the header status badge a button with an accessible label**
- [ ] **Step 3: Render a dialog that explains each stage and keeps the current badge styling where possible**
- [ ] **Step 4: Run `npm test -- src/test/jobDetailStatusGuidance.test.tsx` to verify the regression passes**

### Task 3: Verify no regression in the existing lead guidance flow

**Files:**
- Test: `src/test/leadDetailStatusGuidance.test.tsx`

- [ ] **Step 1: Run `npm test -- src/test/leadDetailStatusGuidance.test.tsx src/test/jobDetailStatusGuidance.test.tsx`**
- [ ] **Step 2: Review output for clean pass status before reporting completion**
