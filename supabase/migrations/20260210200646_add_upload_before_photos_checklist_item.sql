/*\n  # Add "Upload before photos" checklist item for estimate jobs\n\n  1. Changes\n    - Updates the `create_default_checklist_items` trigger function\n    - Estimate visit jobs now get 3 default items:\n      - "Navigate to address" (sort_order 0)\n      - "Upload before photos" (sort_order 1)\n      - "Send client portal" (sort_order 2)\n    - Regular jobs still get just "Navigate to address"\n*/\n\nCREATE OR REPLACE FUNCTION create_default_checklist_items()\nRETURNS TRIGGER\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  IF NEW.status = 'job' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'job')) THEN\n    INSERT INTO job_checklist_items (job_id, account_id, label, sort_order)\n    VALUES (NEW.id, NEW.account_id, 'Navigate to address', 0);
\n\n    IF NEW.is_estimate_visit = true THEN\n      INSERT INTO job_checklist_items (job_id, account_id, label, sort_order)\n      VALUES\n        (NEW.id, NEW.account_id, 'Upload before photos', 1),\n        (NEW.id, NEW.account_id, 'Send client portal', 2);
\n    END IF;
\n  END IF;
\n\n  RETURN NEW;
\nEND;
\n$$;
\n;
