import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface BusinessHours {
  id: string;
  account_id: string;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export function useBusinessHours() {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const { data: businessHours, isLoading } = useQuery({
    queryKey: ['business-hours', currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('account_id', currentAccount.id)
        .order('day_of_week');

      if (error) throw error;
      return data as BusinessHours[];
    },
    enabled: !!user && !!currentAccount,
  });

  const upsertBusinessHours = useMutation({
    mutationFn: async (hours: Omit<BusinessHours, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('business_hours')
        .upsert({
          ...hours,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'account_id,day_of_week',
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
      toast.success('Business hours updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteBusinessHours = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('business_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
      toast.success('Business hours deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    businessHours,
    isLoading,
    upsertBusinessHours: upsertBusinessHours.mutate,
    deleteBusinessHours: deleteBusinessHours.mutate,
  };
}
