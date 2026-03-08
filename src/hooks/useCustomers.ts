import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
    mutationFn: async (input: CreateCustomerInput) => {
      if (!user) throw new Error("Not authenticated");
      if (!currentAccount) throw new Error("No account selected");

      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
          city: input.city || null,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
