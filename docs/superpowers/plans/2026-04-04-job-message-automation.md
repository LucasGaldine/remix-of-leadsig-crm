# Job Message Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement account-configurable job messaging automation with job multi-select, timing rules, and backend endpoint delivery with retries/failure handling.

**Architecture:** Persist rule configuration in `accounts.settings`, enqueue delivery events from DB triggers, and process due events via a scheduled edge function. Keep UI and backend payload shape aligned through shared key conventions.

**Tech Stack:** React + TanStack Query + Supabase Postgres migrations + Supabase Edge Functions + pg_net + pg_cron + Vitest.

---

### Task 1: Add failing UI tests for new automation config

**Files:**
- Modify: `src/test/settingsLeadAutomations.test.tsx`

- [ ] **Step 1: Add tests for hydration and save payload of job automation fields**
- [ ] **Step 2: Run target tests and confirm failures**
Run: `npm test -- src/test/settingsLeadAutomations.test.tsx`
- [ ] **Step 3: Implement minimum UI/state to satisfy tests**
- [ ] **Step 4: Re-run target tests until green**

### Task 2: Implement UI fields and settings persistence

**Files:**
- Modify: `src/pages/SettingsLeadAutomations.tsx`
- Modify: `src/hooks/useAccountSettings.ts`

- [ ] **Step 1: Add settings type for `job_message_automation`**
- [ ] **Step 2: Add local state + hydration + dirty tracking**
- [ ] **Step 3: Add multi-select service type UI and timing/endpoint fields**
- [ ] **Step 4: Save merged payload through existing `updateSettingsAsync` path**

### Task 3: Add backend queue + trigger + schedule migration

**Files:**
- Create: `supabase/migrations/20260404174500_add_job_message_automation_pipeline.sql`

- [ ] **Step 1: Create queue and delivery log tables with indexes**
- [ ] **Step 2: Create helper function to compute scheduled timestamp**
- [ ] **Step 3: Create trigger functions for leads/job_schedules and attach triggers**
- [ ] **Step 4: Add cron schedule for dispatcher edge function**

### Task 4: Implement dispatcher edge function

**Files:**
- Create: `supabase/functions/dispatch-job-message-automation/index.ts`

- [ ] **Step 1: Implement due-event selection + endpoint POST**
- [ ] **Step 2: Add auth header support and complete payload pass-through**
- [ ] **Step 3: Add retry/failure status transitions + delivery log inserts**
- [ ] **Step 4: Return useful summary for monitoring**

### Task 5: Verify and stabilize

**Files:**
- Modify as needed from previous tasks

- [ ] **Step 1: Run focused frontend tests**
Run: `npm test -- src/test/settingsLeadAutomations.test.tsx`
- [ ] **Step 2: Run broader related tests**
Run: `npm test -- src/test/settingsLeadAutomations.test.tsx src/test/jobLifecycle.test.ts`
- [ ] **Step 3: Sanity-check migration SQL for syntax + existing conventions**
- [ ] **Step 4: Summarize risk and any follow-up manual validation steps**
