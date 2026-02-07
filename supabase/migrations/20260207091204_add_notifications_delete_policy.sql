/*
  # Add DELETE policy for notifications

  1. Security Changes
    - Add DELETE policy on `notifications` table for authenticated account members
    - Users can only delete notifications belonging to their own account

  2. Notes
    - Previously only SELECT and UPDATE policies existed, preventing notification deletion
*/

CREATE POLICY "Account members can delete notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = notifications.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
    )
  );