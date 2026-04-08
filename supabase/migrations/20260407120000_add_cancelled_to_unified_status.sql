-- Reintroduce cancelled to support job cancellation lifecycle in archive flows.
ALTER TYPE unified_status ADD VALUE IF NOT EXISTS 'cancelled';
