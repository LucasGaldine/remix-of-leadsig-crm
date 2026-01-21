import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface JobAssignment {
  id: string;
  lead_id: string;
  user_id: string;
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

      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          id,
          lead_id,
          user_id,
          assigned_by,
          assigned_at,
          notes,
          profiles!job_assignments_user_id_fkey (
            full_name,
            email,
            phone
          )
        `)
        .eq('lead_id', leadId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data as JobAssignment[];
    },
    enabled: !!leadId,
  });

  const assignCrewMutation = useMutation({
    mutationFn: async ({ userId, notes }: { userId: string; notes?: string }) => {
      if (!leadId) throw new Error('No lead ID provided');

      const { data: lead } = await supabase
        .from('leads')
        .select('account_id')
        .eq('id', leadId)
        .maybeSingle();

      if (!lead) throw new Error('Job not found');

      const { error } = await supabase
        .from('job_assignments')
        .insert({
          lead_id: leadId,
          user_id: userId,
          account_id: lead.account_id,
          notes: notes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-assignments', leadId] });
      toast.success('Crew member assigned to job');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('This crew member is already assigned to this job');
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
