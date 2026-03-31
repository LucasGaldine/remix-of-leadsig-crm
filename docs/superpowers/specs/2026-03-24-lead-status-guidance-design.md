# Lead Status Guidance Modal Design

**Goal**

Add a modal on the lead detail page that opens when the header status badge is clicked and explains how a lead reaches each lead-only status stage.

**Scope**

- The feature applies only to the lead detail page.
- The modal includes lead statuses only: `new`, `contacted`, `qualified`, and `lost`.
- The modal is informational only. It does not update status or trigger workflow actions.
- Job-related statuses such as `job`, `scheduled`, and `in_progress` are explicitly excluded.

**Approach**

Keep the implementation local to `src/pages/LeadDetail.tsx`. The page already owns the header layout, current status display, and the lead-specific business rules, so the new interaction should stay there instead of modifying the shared `StatusBadge` component.

The current status badge in the header will be wrapped in a button so it is clearly interactive while preserving the existing badge styling. Clicking the trigger opens a `Dialog` using the existing UI primitives already imported on the page.

The dialog body will render from a single local configuration object that defines, for each supported lead status:

- display label
- a short explanation of what the stage means
- a short explanation of what needs to happen to reach that stage

This keeps the content centralized and avoids scattering status copy through the JSX.

**UI Behavior**

- The status badge remains visually consistent with the rest of the app.
- The badge becomes keyboard accessible through a semantic button wrapper.
- The dialog includes a title and description that explain it is a lead pipeline guide.
- The dialog content is read-only and optimized for quick scanning on desktop and mobile.

**Testing**

Add a focused UI test that verifies:

- the lead detail header renders an interactive trigger for the status badge
- clicking the trigger opens the dialog
- the dialog contains only lead statuses
- the dialog does not contain job-related statuses
