import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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
        .select('id, leads!inner(name, service_type)')
        .eq('account_id', dayOff.account_id)
        .eq('scheduled_date', dayOff.date);

      if (checkError) throw checkError;

      if (scheduledJobs && scheduledJobs.length > 0) {
        const jobTitles = scheduledJobs
          .map((job: { leads: { name: string; service_type: string } }) =>
            `${job.leads.name} - ${job.leads.service_type}`
          )
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
      toast.success('Day off added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
      toast.success('Day off updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
      toast.success('Day off removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
