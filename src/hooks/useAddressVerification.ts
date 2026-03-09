import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VerifiedAddress {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip5: string;
  zip4: string;
}

interface VerificationResult {
  verified: boolean;
  address?: VerifiedAddress;
  formatted?: string;
  error?: string;
}

/**
 * Parses a single-line address string into components for USPS API.
 * Handles formats like "123 Main St, Austin, TX 78701"
 */
function parseAddress(raw: string) {
  const parts = raw.split(",").map((p) => p.trim());
  const address1 = parts[0] || "";
  let city = "";
  let state = "";
  let zip = "";

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim();
    // Try to extract state + zip from last part
    const stateZipMatch = lastPart.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)$/);
    if (stateZipMatch) {
      state = stateZipMatch[1].toUpperCase();
      zip = stateZipMatch[2];
      city = parts.length >= 3 ? parts[parts.length - 2].trim() : "";
    } else {
      city = parts.length >= 3 ? parts[1].trim() : lastPart;
    }
  }

  return { address1, city, state, zip };
}

export function useAddressVerification() {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const verify = useCallback(async (addressString: string) => {
    if (!addressString.trim()) {
      setResult(null);
      return null;
    }

    setVerifying(true);
    setResult(null);

    try {
      const parsed = parseAddress(addressString);

      const { data, error } = await supabase.functions.invoke("verify-address", {
        body: parsed,
      });

      if (error) {
        const res: VerificationResult = { verified: false, error: error.message };
        setResult(res);
        return res;
      }

      setResult(data as VerificationResult);
      return data as VerificationResult;
    } catch (err: any) {
      const res: VerificationResult = { verified: false, error: err.message };
      setResult(res);
      return res;
    } finally {
      setVerifying(false);
    }
  }, []);

  const reset = useCallback(() => setResult(null), []);

  return { verify, verifying, result, reset };
}
