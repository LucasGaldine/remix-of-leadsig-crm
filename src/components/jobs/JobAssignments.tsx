import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useJobAssignments } from '@/hooks/useJobAssignments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, UserPlus, X, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface JobAssignmentsProps {
  leadId: string;
}

interface CrewMember {
  user_id: string;
  role: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  };
}

export function JobAssignments({ leadId }: JobAssignmentsProps) {
  const { currentAccount, isManager } = useAuth();
  const { assignments, isLoading, assignCrew, unassignCrew, isAssigning, isUnassigning } =
    useJobAssignments(leadId);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [assignmentToRemove, setAssignmentToRemove] = useState<string | null>(null);

  const { data: availableMembers } = useQuery({
    queryKey: ['crew-members', currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from('account_members')
        .select(`
          user_id,
          role,
          profiles!account_members_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq('account_id', currentAccount.id)
        .eq('is_active', true)
        .order('role', { ascending: false });

      if (error) throw error;
      return data as CrewMember[];
    },
    enabled: !!currentAccount && isManager(),
  });

  const unassignedMembers = availableMembers?.filter(
    (member) => !assignments?.some((assignment) => assignment.user_id === member.user_id)
  );

  const handleAssign = () => {
    if (selectedMember) {
      assignCrew({ userId: selectedMember });
      setSelectedMember('');
    }
  };

  const handleUnassign = () => {
    if (assignmentToRemove) {
      unassignCrew(assignmentToRemove);
      setAssignmentToRemove(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Assigned Crew ({assignments?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isManager() && (
          <div className="flex gap-2">
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select crew member" />
              </SelectTrigger>
              <SelectContent>
                {unassignedMembers?.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    All crew members assigned
                  </div>
                ) : (
                  unassignedMembers?.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profiles?.full_name || 'Unknown'} -{' '}
                      {member.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedMember || isAssigning}
              className="shrink-0"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Assign
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !assignments || assignments.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No crew assigned yet</p>
            {isManager() && (
              <p className="text-sm text-muted-foreground mt-1">
                Assign crew members to this job using the dropdown above
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1">
                    <div className="font-medium">
                      {assignment.profiles?.full_name || 'Unknown'}
                    </div>
                    {assignment.profiles?.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3" />
                        {assignment.profiles.email}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </Badge>
                </div>
                {isManager() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAssignmentToRemove(assignment.id)}
                    disabled={isUnassigning}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog
        open={!!assignmentToRemove}
        onOpenChange={(open) => !open && setAssignmentToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this crew member from this job?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassign}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
