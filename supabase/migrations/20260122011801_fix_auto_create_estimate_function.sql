/*\n  # Fix auto_create_estimate_for_job function\n  \n  ## Overview\n  Update the auto_create_estimate_for_job function to use the new simplified status enum values.\n  \n  ## Changes\n  - Replace old status checks ('scheduled', 'in_progress', 'completed', 'won', 'invoiced', 'paid')\n  - Use new status values ('job', 'paid')\n*/\n\nCREATE OR REPLACE FUNCTION public.auto_create_estimate_for_job()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path TO 'public'\nAS $function$\nBEGIN\n  -- Only create estimate for actual jobs (not leads)\n  IF NEW.status IN ('job', 'paid') \n  AND NEW.approval_status = 'approved' THEN\n    \n    -- Check if estimate already exists for this job\n    IF NOT EXISTS (SELECT 1 FROM public.estimates WHERE job_id = NEW.id) THEN\n      -- Create a draft estimate linked to the job\n      INSERT INTO public.estimates (\n        customer_id,\n        job_id,\n        account_id,\n        subtotal,\n        tax_rate,\n        tax,\n        discount,\n        total,\n        status,\n        created_by,\n        notes\n      ) VALUES (\n        NEW.customer_id,\n        NEW.id,\n        NEW.account_id,\n        0,\n        0.08,\n        0,\n        0,\n        0,\n        'draft',\n        NEW.created_by,\n        'Auto-generated estimate for ' || NEW.name\n      );
\n      \n      RAISE NOTICE 'Auto-created estimate for job %', NEW.id;
\n    END IF;
\n  END IF;
\n  \n  RETURN NEW;
\nEND;
\n$function$;
\n;
