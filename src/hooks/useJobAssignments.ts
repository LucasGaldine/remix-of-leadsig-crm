import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface JobAssignment {
  id: string;
  lead_id: string;
  user_id: string;
  job_schedule_id: string | null;
  assigned_by: string;
  assigned_at: string;
  notes: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
}

export function useJobAssignments(leadId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['job-assignments', leadId],
    queryFn: async () => {
      if (!leadId) return [];

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('id, lead_id, user_id, job_schedule_id, assigned_by, assigned_at, notes')
        .eq('lead_id', leadId)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;
      if (!assignmentsData || assignmentsData.length === 0) return [];

      const userIds = assignmentsData.map(a => a.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      return assignmentsData.map(assignment => ({
        ...assignment,
        profiles: profilesMap.get(assignment.user_id) || { full_name: null, email: null, phone: null }
      })) as JobAssignment[];
    },
    enabled: !!leadId,
  });

  const assignCrewMutation = useMutation({
    mutationFn: async ({
      userId,
      scheduleId,
      scheduleIds,
      notes
    }: {
      userId: string;
      scheduleId?: string;
      scheduleIds?: string[];
      notes?: string
    }) => {
      if (!leadId) throw new Error('No lead ID provided');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: lead } = await supabase
        .from('leads')
        .select('account_id')
        .eq('id', leadId)
        .maybeSingle();

      if (!lead) throw new Error('Job not found');

      const schedules = scheduleIds || (scheduleId ? [scheduleId] : []);

      if (schedules.length === 0) {
        throw new Error('At least one schedule must be selected');
      }

      const { data: targetSchedules, error: schedError } = await supabase
        .from('job_schedules')
        .select('id, scheduled_date, scheduled_time_start, scheduled_time_end')
        .in('id', schedules);

      if (schedError) throw schedError;
      if (!targetSchedules || targetSchedules.length === 0) {
        throw new Error('Selected schedules not found');
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle();

      const userName = userProfile?.full_name || 'This crew member';

      for (const targetSchedule of targetSchedules) {
        const { data: existingAssignments, error: checkError } = await supabase
          .from('job_assignments')
          .select(`
            id,
            job_schedule_id,
            job_schedules!inner (
              scheduled_date,
              scheduled_time_start,
              scheduled_time_end,
              leads!inner (
                title
              )
            )
          `)
          .eq('user_id', userId)
          .eq('account_id', lead.account_id);

        if (checkError) throw checkError;

        if (existingAssignments) {
          for (const existing of existingAssignments) {
            const existingSchedule = existing.job_schedules;

            if (existingSchedule.scheduled_date === targetSchedule.scheduled_date) {
              const hasTimeOverlap =
                !targetSchedule.scheduled_time_start ||
                !targetSchedule.scheduled_time_end ||
                !existingSchedule.scheduled_time_start ||
                !existingSchedule.scheduled_time_end ||
                (
                  targetSchedule.scheduled_time_start < existingSchedule.scheduled_time_end &&
                  targetSchedule.scheduled_time_end > existingSchedule.scheduled_time_start
                );

              if (hasTimeOverlap) {
                const dateStr = new Date(targetSchedule.scheduled_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                });

                const timeStr = existingSchedule.scheduled_time_start && existingSchedule.scheduled_time_end
                  ? ` from ${existingSchedule.scheduled_time_start} - ${existingSchedule.scheduled_time_end}`
                  : '';

                const jobTitle = existingSchedule.leads?.title || 'another job';

                throw new Error(
                  `${userName} is already assigned to "${jobTitle}" on ${dateStr}${timeStr}`
                );
              }
            }
          }
        }
      }

      const assignments = schedules.map(sId => ({
        lead_id: leadId,
        user_id: userId,
        job_schedule_id: sId,
        account_id: lead.account_id,
        assigned_by: user.id,
        notes: notes || null,
      }));

      const { error } = await supabase
        .from('job_assignments')
        .insert(assignments);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-assignments', leadId] });
      toast.success('Crew member assigned to job');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('This crew member is already assigned to this schedule');
      } else if (error.message.includes('already assigned to')) {
        toast.error(error.message, { duration: 5000 });
      } else {
        toast.error('Failed to assign crew member: ' + error.message);
      }
    },
  });

  const unassignCrewMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-assignments', leadId] });
      toast.success('Crew member removed from job');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove crew member: ' + error.message);
    },
  });

  return {
    assignments,
    isLoading,
    assignCrew: assignCrewMutation.mutate,
    unassignCrew: unassignCrewMutation.mutate,
    isAssigning: assignCrewMutation.isPending,
    isUnassigning: unassignCrewMutation.isPending,
  };
}
