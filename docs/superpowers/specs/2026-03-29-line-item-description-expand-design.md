# Line Item Description Expand in Edit Estimate

## Overview
We need to keep the compact line item cards inside the Edit Estimate modal from overflowing when the description is very long. Instead of the description pushing the modal into an extra scroll state, the card should clamp to three lines by default and show a `View more` toggle that expands just that description inline (and switches to `View less`). The modal should stay scroll-free unless the entire list itself is too long.

## Goals
1. Limit the description to three visually wrapped lines in compact mode, showing an ellipsis choice.
2. Provide an inline `View more`/`View less` toggle that expands only the current description and lets the card height grow dynamically.
3. Keep edit/delete controls aligned with the product name/quantity and consistently vertically centered.
4. Avoid introducing new modals or drawers; the change should be fully contained in the compact line item card.

## UX Flow
- The compact card renders the item name, quantity, price, and action icons on a top row, with the description below.
- If the description exceeds the clamp (approx. 3 lines / ~180 characters), render a small `View more` text button under the clamped text.
- Tapping `View more` removes the line clamp and expands the card to show the entire description; the toggle text becomes `View less`.
- Each description remembers its expanded/collapsed state independently.

## Technical Approach
1. **State management:** Track expansion per line item using a stable key (prefer `item.id`, falling back to a generated placeholder such as `new-${index}`) so toggles stay bound to the same description even when items are reordered or removed. Store the keys of the expanded descriptions in a `Set<string>` inside `useState`, and provide a toggle handler to add/remove keys.
2. **Card layout:** Keep the current flexbox layout but ensure the top row uses `items-center` so name/qty and the price/actions line up vertically. Move the description below the top row inside its own block.
3. **Clamping logic:** When `isDescriptionExpanded` is false, apply `line-clamp-3` so the text shows an ellipsis. Apply `break-words` to keep text inside the card. When expanded, drop the clamp so the full text is visible.
4. **Toggle visibility:** Only show the `View more`/`View less` button when the description exceeds a tuned heuristic (e.g., 180 characters or similar) so the toggle only appears for definitely long descriptions; DOM measurement of line count is brittle, so a deterministic character-length rule with a generous threshold is acceptable for QA, and the UI can always show the toggle while text is clamped for extra safety.
5. **Button:** Use a `button` element with `type="button"` and subdued text styling to fit existing UI patterns; the toggle spans the full width of the description area for clarity.

## Component Interface Changes
- `CompactLineItem` now accepts `isDescriptionExpanded: boolean` and `onToggleDescription: () => void` props so the parent controls expansion state.
- `EditEstimateModal` supplies these props during the `lineItems.map` loop and tracks expansion keys (strings) with a `Set<string>` stored in `useState`.

## Testing & Verification
- Manual QA by populating a line item description with long text, confirming that only three lines show initially and the modal does not scroll.
- Click `View more` to ensure the description expands within the card and the button label changes to `View less`; collapse it again to revert.
- Confirm the top row remains vertically centered when the description is expanded versus collapsed.
- Ensure new toggle only appears on descriptions that are long enough to justify it.
- Record in the spec that the toggle uses the current ~180-character heuristic so QA knows when the button should appear and can retune it if text wrapping changes.

```
Path: docs/superpowers/specs/2026-03-29-line-item-description-expand-design.md
```
