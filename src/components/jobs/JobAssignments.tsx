import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useJobAssignments } from '@/hooks/useJobAssignments';
import { useJobSchedules } from '@/hooks/useJobSchedules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Users, UserPlus, X, Mail, Calendar, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

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
  const { data: schedules, isLoading: schedulesLoading } = useJobSchedules(leadId);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<string | null>(null);

  const { data: availableMembers } = useQuery({
    queryKey: ['crew-members', currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from('account_members_with_profiles')
        .select('user_id, role, full_name, email')
        .eq('account_id', currentAccount.id)
        .eq('is_active', true)
        .order('role', { ascending: false });

      if (error) throw error;

      return data.map(member => ({
        user_id: member.user_id,
        role: member.role,
        profiles: {
          full_name: member.full_name,
          email: member.email
        }
      })) as CrewMember[];
    },
    enabled: !!currentAccount && isManager(),
  });

  const getScheduleAssignments = (scheduleId: string) => {
    return assignments?.filter(a => a.job_schedule_id === scheduleId) || [];
  };

  const toggleSchedule = (scheduleId: string) => {
    setSelectedSchedules(prev =>
      prev.includes(scheduleId)
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const toggleAllSchedules = () => {
    if (!schedules) return;
    if (selectedSchedules.length === schedules.length) {
      setSelectedSchedules([]);
    } else {
      setSelectedSchedules(schedules.map(s => s.id));
    }
  };

  const openAssignDialog = () => {
    setSelectedSchedules([]);
    setShowAssignDialog(true);
  };

  const handleAssign = () => {
    if (selectedMember && selectedSchedules.length > 0) {
      assignCrew({ userId: selectedMember, scheduleIds: selectedSchedules });
      setSelectedMember('');
      setSelectedSchedules([]);
      setShowAssignDialog(false);
    }
  };

  const handleUnassign = () => {
    if (assignmentToRemove) {
      unassignCrew(assignmentToRemove);
      setAssignmentToRemove(null);
    }
  };

  if (schedulesLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assigned Crew
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assigned Crew
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No schedules created yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create job schedules first to assign crew members
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assigned Crew
          </CardTitle>
          {isManager() && (
            <Button onClick={openAssignDialog} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Crew
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.map((schedule) => {
          const scheduleAssignments = getScheduleAssignments(schedule.id);
          return (
            <div key={schedule.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(schedule.scheduled_date), 'EEEE, MMMM d, yyyy')}
                  </div>
                  {schedule.scheduled_time_start && schedule.scheduled_time_end && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {schedule.scheduled_time_start} - {schedule.scheduled_time_end}
                    </div>
                  )}
                </div>
                <Badge variant="outline">
                  {scheduleAssignments.length} assigned
                </Badge>
              </div>

              {scheduleAssignments.length > 0 ? (
                <div className="space-y-2">
                  {scheduleAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">
                          {assignment.profiles?.full_name || 'Unknown'}
                        </div>
                        {assignment.profiles?.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {assignment.profiles.email}
                          </div>
                        )}
                      </div>
                      {isManager() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssignmentToRemove(assignment.id)}
                          disabled={isUnassigning}
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-2">
                  No crew assigned to this schedule
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Crew Member</DialogTitle>
            <DialogDescription>
              Select a crew member and the schedule(s) to assign them to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Crew Member</label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crew member" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers?.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No crew members available
                    </div>
                  ) : (
                    availableMembers?.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles?.full_name || 'Unknown'} -{' '}
                        {member.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Schedules</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllSchedules}
                  type="button"
                >
                  {selectedSchedules.length === schedules?.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                {schedules?.map((schedule) => (
                  <div key={schedule.id} className="flex items-start gap-2">
                    <Checkbox
                      id={schedule.id}
                      checked={selectedSchedules.includes(schedule.id)}
                      onCheckedChange={() => toggleSchedule(schedule.id)}
                      className="p-1"
                    />
                    <label
                      htmlFor={schedule.id}
                      className="text-sm flex-1 cursor-pointer"
                    >
                      <div className="font-medium">
                        {format(new Date(schedule.scheduled_date), 'EEEE, MMM d')}
                      </div>
                      {schedule.scheduled_time_start && schedule.scheduled_time_end && (
                        <div className="text-xs text-muted-foreground">
                          {schedule.scheduled_time_start} - {schedule.scheduled_time_end}
                        </div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false);
                setSelectedMember('');
                setSelectedSchedules([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedMember || selectedSchedules.length === 0 || isAssigning}
            >
              Assign to {selectedSchedules.length} schedule{selectedSchedules.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
