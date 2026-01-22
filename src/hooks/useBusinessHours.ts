import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: businessHours, isLoading } = useQuery({
    queryKey: ['business-hours', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .order('day_of_week');

      if (error) throw error;
      return data as BusinessHours[];
    },
    enabled: !!user,
  });

  const upsertBusinessHours = useMutation({
    mutationFn: async (hours: Omit<BusinessHours, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('business_hours')
        .upsert(hours, {
          onConflict: 'account_id,day_of_week',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
      toast({
        title: 'Success',
        description: 'Business hours updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Success',
        description: 'Business hours deleted',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    businessHours,
    isLoading,
    upsertBusinessHours: upsertBusinessHours.mutate,
    deleteBusinessHours: deleteBusinessHours.mutate,
  };
}
