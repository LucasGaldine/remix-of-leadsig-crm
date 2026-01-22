import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface DayOff {
  id: string;
  account_id: string;
  date: string;
  reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useDaysOff() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: daysOff, isLoading } = useQuery({
    queryKey: ['days-off', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('days_off')
        .select('*')
        .order('date');

      if (error) throw error;
      return data as DayOff[];
    },
    enabled: !!user,
  });

  const addDayOff = useMutation({
    mutationFn: async (dayOff: { account_id: string; date: string; reason?: string }) => {
      const { data: scheduledJobs, error: checkError } = await supabase
        .from('job_schedules')
        .select('id, leads!inner(title)')
        .eq('account_id', dayOff.account_id)
        .eq('scheduled_date', dayOff.date);

      if (checkError) throw checkError;

      if (scheduledJobs && scheduledJobs.length > 0) {
        const jobTitles = scheduledJobs
          .map((job: { leads: { title: string } }) => job.leads.title)
          .join(', ');
        throw new Error(
          `Cannot add day off: ${scheduledJobs.length} job(s) already scheduled on this date (${jobTitles})`
        );
      }

      const { data, error } = await supabase
        .from('days_off')
        .insert({
          account_id: dayOff.account_id,
          date: dayOff.date,
          reason: dayOff.reason,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days-off'] });
      toast({
        title: 'Success',
        description: 'Day off added',
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

  const updateDayOff = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await supabase
        .from('days_off')
        .update({ reason, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days-off'] });
      toast({
        title: 'Success',
        description: 'Day off updated',
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

  const deleteDayOff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('days_off')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days-off'] });
      toast({
        title: 'Success',
        description: 'Day off removed',
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
    daysOff,
    isLoading,
    addDayOff: addDayOff.mutate,
    updateDayOff: updateDayOff.mutate,
    deleteDayOff: deleteDayOff.mutate,
  };
}
