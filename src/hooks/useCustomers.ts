import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  account_id: string | null;
  created_at: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}

export function useCustomers(searchQuery?: string) {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["customers", currentAccount?.id, searchQuery],
    queryFn: async () => {
      if (!currentAccount) return [];

      let query = supabase
        .from("customers")
        .select("*")
        .eq("account_id", currentAccount.id)
        .order("name", { ascending: true });

      if (searchQuery && searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!user && !!currentAccount,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { user, currentAccount } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput & { forceNew?: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      if (!currentAccount) throw new Error("No account selected");

      let customerId: string;

      if (input.forceNew) {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            name: input.name,
            email: input.email?.trim() || null,
            phone: input.phone?.trim() || null,
            address: input.address?.trim() || null,
            city: input.city?.trim() || null,
            created_by: user.id,
            account_id: currentAccount.id,
          })
          .select("id")
          .single();

        if (error) throw error;
        customerId = data.id;
      } else {
        const { id } = await findOrCreateCustomer({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
          city: input.city || null,
          created_by: user.id,
          account_id: currentAccount.id,
        });
        customerId = id;
      }

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
