/*
  # Ignore reorder-only estimate changes for pending change orders

  ## Why
  The original `has_pending_changes` trigger treated any unapproved edited
  change-order row as pending, even if the only difference was `sort_order`.
  That made pure line-item reordering look like a sendable change order.

  ## What this does
  - Rebuilds `check_estimate_pending_changes()` so pending status only turns on
    for substantive changes:
    - added change-order items
    - deleted change-order items
    - edited change-order items whose content differs from the original item
  - Ignores reorder-only edited rows where the fields are otherwise identical
*/

CREATE OR REPLACE FUNCTION check_estimate_pending_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE estimates
  SET has_pending_changes = EXISTS (
    SELECT 1
    FROM estimate_line_items pending
    LEFT JOIN estimate_line_items original
      ON original.id = pending.original_line_item_id
    WHERE pending.estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id)
      AND pending.is_change_order = true
      AND pending.change_order_approved = false
      AND (
        pending.change_order_type IN ('added', 'deleted')
        OR pending.change_order_type <> 'edited'
        OR pending.original_line_item_id IS NULL
        OR original.id IS NULL
        OR pending.name IS DISTINCT FROM original.name
        OR NULLIF(pending.description, '') IS DISTINCT FROM NULLIF(original.description, '')
        OR pending.quantity IS DISTINCT FROM original.quantity
        OR pending.unit IS DISTINCT FROM original.unit
        OR pending.unit_price IS DISTINCT FROM original.unit_price
        OR COALESCE(pending.category, 'other') IS DISTINCT FROM COALESCE(original.category, 'other')
      )
  )
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;
