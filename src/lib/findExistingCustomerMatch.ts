import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/hooks/useCustomers";

export type ExistingCustomerMatchReason =
  | "address_and_name"
  | "phone"
  | "email";

export interface ExistingCustomerMatch {
  customer: Customer;
  reason: ExistingCustomerMatchReason;
}

interface FindExistingCustomerMatchInput {
  accountId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/**
 * Mirrors customer dedupe priority used by findOrCreateCustomer so UI can confirm
 * before linking to an existing contact.
 */
export async function findExistingCustomerMatch(
  input: FindExistingCustomerMatchInput,
): Promise<ExistingCustomerMatch | null> {
  const normalizedAddress = input.address?.trim().toLowerCase() || "";
  const normalizedName = input.name?.trim().toLowerCase() || "";

  if (normalizedAddress && normalizedName) {
    const { data: byAddressAndName } = await supabase
      .from("customers")
      .select("*")
      .eq("account_id", input.accountId)
      .ilike("address", normalizedAddress)
      .ilike("name", normalizedName)
      .limit(1)
      .maybeSingle();

    if (byAddressAndName) {
      return { customer: byAddressAndName as Customer, reason: "address_and_name" };
    }
  }

  const trimmedPhone = input.phone?.trim();
  if (trimmedPhone) {
    const { data: byPhone } = await supabase
      .from("customers")
      .select("*")
      .eq("account_id", input.accountId)
      .eq("phone", trimmedPhone)
      .limit(1)
      .maybeSingle();

    if (byPhone) {
      return { customer: byPhone as Customer, reason: "phone" };
    }
  }

  const trimmedEmail = input.email?.trim();
  if (trimmedEmail) {
    const { data: byEmail } = await supabase
      .from("customers")
      .select("*")
      .eq("account_id", input.accountId)
      .ilike("email", trimmedEmail)
      .limit(1)
      .maybeSingle();

    if (byEmail) {
      return { customer: byEmail as Customer, reason: "email" };
    }
  }

  return null;
}
