# Disabled Schedule Visit Explanation Design

**Goal**

Explain why the `Schedule Visit` action is disabled on the lead detail page when the lead is missing required location information.

**Scope**

- The change applies only to the `Schedule Visit` CTA on the lead detail page.
- The explanation is specific to the current blocking rule.
- Current blocked rule: the lead is missing an address or city, so the visit cannot be scheduled.
- Enabled states should keep the existing behavior with no extra messaging.

**Approach**

Keep the implementation local to `src/pages/LeadDetail.tsx`. The page already owns the `Schedule Visit` button state through `hasAddress`, so the disabled explanation should be derived from the same condition instead of introducing a shared abstraction.

When `Schedule Visit` is disabled, render the button inside a wrapper that can still receive interaction. The wrapper will expose:

- a tooltip for hover/focus on desktop
- a popover for tap interaction on touch devices

Both surfaces use the same message: `Add an address and city to schedule a visit.`

This preserves the visual disabled state while still making the reason discoverable.

**UI Behavior**

- Disabled `Schedule Visit` remains visibly disabled.
- Hovering or focusing the disabled state on desktop shows the specific reason.
- Tapping the disabled state on mobile shows the same reason in a tap-friendly surface.
- Enabled `Schedule Visit` continues opening the estimate dialog directly.

**Testing**

Add a focused UI test that verifies:

- when the lead has no address/city, the disabled `Schedule Visit` affordance exposes the specific explanation
- the explanation text matches the blocking rule
- when the lead has address/city, the explanation is not shown
