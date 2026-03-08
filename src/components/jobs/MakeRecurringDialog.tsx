import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConvertToRecurring, RecurrenceFrequency } from "@/hooks/useRecurringJobs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MakeRecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobSchedules?: Array<{
    scheduled_time_start?: string | null;
    scheduled_time_end?: string | null;
  }>;
}

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
};

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function MakeRecurringDialog({ open, onOpenChange, jobId, jobSchedules }: MakeRecurringDialogProps) {
  const { currentAccount } = useAuth();
  const convertToRecurring = useConvertToRecurring();

  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [startDate, setStartDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [timeStart, setTimeStart] = useState(jobSchedules?.[0]?.scheduled_time_start || "");
  const [timeEnd, setTimeEnd] = useState(jobSchedules?.[0]?.scheduled_time_end || "");
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<string>("");
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);

  const { data: crewMembers = [] } = useQuery({
    queryKey: ["crew-members", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];
      const { data, error } = await supabase
        .from("account_members_with_profiles")
        .select("user_id, role, full_name, email")
        .eq("account_id", currentAccount.id)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentAccount && open,
  });

  const toggleDayOfWeek = (day: number) => {
    setSelectedDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleCrewMember = (userId: string) => {
    setSelectedCrew((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!startDate) {
      toast.error("Start date is required");
      return;
    }

    if ((frequency === "weekly" || frequency === "biweekly") && selectedDaysOfWeek.length === 0) {
      toast.error("Select at least one day of the week");
      return;
    }

    if (frequency === "monthly" && !selectedDayOfMonth) {
      toast.error("Select a day of the month");
      return;
    }

    try {
      await convertToRecurring.mutateAsync({
        jobId,
        frequency,
        start_date: startDate,
        end_date: hasEndDate && endDate ? endDate : null,
        scheduled_time_start: timeStart || null,
        scheduled_time_end: timeEnd || null,
        preferred_days_of_week: (frequency === "weekly" || frequency === "biweekly") ? selectedDaysOfWeek : [],
        preferred_day_of_month: frequency === "monthly" && selectedDayOfMonth ? parseInt(selectedDayOfMonth) : null,
        default_crew_user_ids: selectedCrew,
      });

      toast.success("Job schedule created! Future visits and a shared quote have been set up.");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating job schedule:", error);
      toast.error("Failed to create job schedule");
    }
  };

  const ordinal = (n: number) => {
    if (n === 1 || n === 21 || n === 31) return `${n}st`;
    if (n === 2 || n === 22) return `${n}nd`;
    if (n === 3 || n === 23) return `${n}rd`;
    return `${n}th`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Job Schedule</DialogTitle>
          <DialogDescription>
            Set up a recurring schedule. A shared quote and client portal will be created for all visits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="font-semibold">Frequency</Label>
            <Select value={frequency} onValueChange={(v) => { setFrequency(v as RecurrenceFrequency); setSelectedDaysOfWeek([]); setSelectedDayOfMonth(""); }}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(frequency === "weekly" || frequency === "biweekly") && (
            <div className="space-y-2">
              <Label className="font-semibold">Days of the Week</Label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDayOfWeek(day.value)}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                      selectedDaysOfWeek.includes(day.value)
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === "monthly" && (
            <div className="space-y-2">
              <Label className="font-semibold">Day of the Month</Label>
              <Select value={selectedDayOfMonth} onValueChange={setSelectedDayOfMonth}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>{ordinal(day)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                For months with fewer days, the job will be scheduled on the last day.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">End Date</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="recurEndDate"
                    checked={hasEndDate}
                    onCheckedChange={(c) => setHasEndDate(c === true)}
                  />
                  <label htmlFor="recurEndDate" className="text-xs text-gray-500 cursor-pointer">Set end</label>
                </div>
              </div>
              {hasEndDate ? (
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="h-11"
                />
              ) : (
                <div className="h-11 flex items-center px-3 text-sm text-gray-500 border rounded-md bg-gray-50">
                  Ongoing
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Start Time</Label>
              <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">End Time</Label>
              <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="h-11" />
            </div>
          </div>

          {crewMembers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-600" />
                <Label className="font-semibold">Default Crew</Label>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {crewMembers.map((member: any) => (
                  <label
                    key={member.user_id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedCrew.includes(member.user_id)}
                      onCheckedChange={() => toggleCrewMember(member.user_id)}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.full_name || member.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{member.role?.replace("_", " ")}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={convertToRecurring.isPending}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {convertToRecurring.isPending ? "Setting up..." : "Create Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
