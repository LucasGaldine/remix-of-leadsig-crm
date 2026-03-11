import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CustomerAttention {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  reason?: string;
}

export function useCustomersNeedingAttention() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["customers-needing-attention", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, address, city")
        .eq("account_id", currentAccount.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching customers:", error);
        return [];
      }

      return (data || []).map((customer) => ({
        id: customer.id,
        name: customer.name || "Unknown",
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
      }));
    },
    enabled: !!user && !!currentAccount,
  });
}
