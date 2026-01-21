import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { JobCard } from "@/components/jobs/JobCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Calendar, Clock } from "lucide-react";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function CrewDashboard() {
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();

  const { data: assignedJobs = [], isLoading } = useQuery({
    queryKey: ['crew-assigned-jobs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          lead_id,
          assigned_at,
          leads:lead_id (
            id,
            name,
            email,
            phone,
            status,
            address,
            city,
            state,
            service_type,
            estimated_value,
            scheduled_date,
            scheduled_time_start,
            scheduled_time_end,
            notes,
            created_at,
            customers:customer_id (
              name,
              email,
              phone
            )
          )
        `)
        .eq('user_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data
        .filter(assignment => assignment.leads)
        .map(assignment => assignment.leads);
    },
    enabled: !!user?.id,
  });

  const { data: upcomingSchedules = [] } = useQuery({
    queryKey: ['crew-upcoming-schedules', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('job_schedules')
        .select(`
          id,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          is_completed,
          lead_id,
          leads:lead_id (
            id,
            name,
            address,
            city,
            service_type
          )
        `)
        .gte('scheduled_date', today)
        .in('lead_id', assignedJobs.map(job => job.id))
        .eq('is_completed', false)
        .order('scheduled_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && assignedJobs.length > 0,
  });

  const todayJobs = assignedJobs.filter(job =>
    job.status === 'scheduled' || job.status === 'in_progress'
  );

  const completedJobs = assignedJobs.filter(job =>
    job.status === 'completed' || job.status === 'paid'
  );

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title={`Welcome, ${user?.user_metadata?.full_name || 'Crew Member'}`}
        subtitle={currentAccount?.company_name || 'Dashboard'}
      />

      <main className="px-4 py-4 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Briefcase className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{todayJobs.length}</div>
                <div className="text-sm text-muted-foreground">Active Jobs</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Clock className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{upcomingSchedules.length}</div>
                <div className="text-sm text-muted-foreground">Upcoming</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Calendar className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{completedJobs.length}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {upcomingSchedules.length > 0 && (
          <section>
            <SectionHeader
              title="Upcoming Schedules"
              count={upcomingSchedules.length}
              action={{ label: "View calendar", onClick: () => navigate("/schedule") }}
              className="mb-3"
            />
            <div className="space-y-2">
              {upcomingSchedules.map((schedule) => (
                <button
                  key={schedule.id}
                  onClick={() => navigate(`/jobs/${schedule.lead_id}`)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-base">{schedule.leads?.name || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">
                        {schedule.leads?.service_type || 'Service'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {new Date(schedule.scheduled_date).toLocaleDateString()}
                      </div>
                      {schedule.scheduled_time_start && (
                        <div className="text-xs text-muted-foreground">
                          {schedule.scheduled_time_start} - {schedule.scheduled_time_end || 'TBD'}
                        </div>
                      )}
                    </div>
                  </div>
                  {schedule.leads?.address && (
                    <div className="text-sm text-muted-foreground">
                      {schedule.leads.address}, {schedule.leads.city}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader
            title="My Assigned Jobs"
            count={assignedJobs.length}
            action={{ label: "View all", onClick: () => navigate("/jobs") }}
            className="mb-3"
          />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : assignedJobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No jobs assigned yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your manager will assign jobs to you
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {assignedJobs.map((job: any) => (
                <JobCard
                  key={job.id}
                  job={{
                    id: job.id,
                    clientName: job.customers?.name || job.name || "Unknown Client",
                    serviceType: job.service_type || "Unknown Service",
                    status: job.status,
                    scheduledDate: job.scheduled_date,
                    scheduledTime: job.scheduled_time_start,
                    address: job.address,
                    city: job.city,
                    state: job.state,
                    estimatedValue: Number(job.estimated_value) || 0,
                    createdAt: formatDistanceToNow(new Date(job.created_at), { addSuffix: true }),
                    notes: job.notes,
                  }}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
