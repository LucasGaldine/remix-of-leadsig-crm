/*
  # Ignore reorder-only estimate edits for pending change orders

  Reordering accepted estimate line items should not trigger the change-order
  approval flow. Pending changes should only be flagged for substantive edits,
  not for `edited` rows whose only difference is sort order.
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
    FROM estimate_line_items eli
    WHERE eli.estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id)
      AND eli.is_change_order = true
      AND eli.change_order_approved = false
      AND (
        eli.change_order_type IN ('added', 'deleted')
        OR (
          eli.change_order_type = 'edited'
          AND EXISTS (
            SELECT 1
            FROM estimate_line_items original
            WHERE original.id = eli.original_line_item_id
              AND (
                original.name IS DISTINCT FROM eli.name
                OR original.description IS DISTINCT FROM eli.description
                OR original.quantity IS DISTINCT FROM eli.quantity
                OR original.unit IS DISTINCT FROM eli.unit
                OR original.unit_price IS DISTINCT FROM eli.unit_price
                OR COALESCE(original.category, 'other') IS DISTINCT FROM COALESCE(eli.category, 'other')
              )
          )
        )
      )
  )
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;
