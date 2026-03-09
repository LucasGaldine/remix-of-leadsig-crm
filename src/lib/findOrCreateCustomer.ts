import { supabase } from "@/integrations/supabase/client";

interface CustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  created_by: string;
  account_id?: string | null;
}

/**
 * Finds an existing customer by normalized address (primary), phone, or email.
 * Creates a new customer only if no match is found.
 */
export async function findOrCreateCustomer(input: CustomerInput): Promise<{ id: string }> {
  const normalizedAddress = input.address?.trim().toLowerCase() || "";
  const accountId = input.account_id || null;

  // 1. Match by address (strongest dedup signal)
  if (normalizedAddress) {
    const { data: byAddress } = await supabase
      .from("customers")
      .select("id")
      .eq("account_id", accountId as any)
      .ilike("address", normalizedAddress)
      .limit(1)
      .maybeSingle();

    if (byAddress) return { id: byAddress.id };
  }

  // 2. Match by phone
  if (input.phone?.trim()) {
    const { data: byPhone } = await supabase
      .from("customers")
      .select("id")
      .eq("account_id", accountId as any)
      .eq("phone", input.phone.trim())
      .limit(1)
      .maybeSingle();

    if (byPhone) return { id: byPhone.id };
  }

  // 3. Match by email
  if (input.email?.trim()) {
    const { data: byEmail } = await supabase
      .from("customers")
      .select("id")
      .eq("account_id", accountId as any)
      .ilike("email", input.email.trim())
      .limit(1)
      .maybeSingle();

    if (byEmail) return { id: byEmail.id };
  }

  // 4. No match — create new customer
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      created_by: input.created_by,
      account_id: accountId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}
