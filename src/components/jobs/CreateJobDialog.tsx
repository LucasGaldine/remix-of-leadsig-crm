import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateJob } from "@/hooks/useJobs";
import { useCreateRecurringJob, RecurrenceFrequency } from "@/hooks/useRecurringJobs";
import { useCreateCustomer, type Customer, type CreateCustomerInput } from "@/hooks/useCustomers";
import { useAddJobSchedule } from "@/hooks/useJobSchedules";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Repeat, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientSelector } from "@/components/clients/ClientSelector";
import { SERVICE_TYPES } from "@/constants/serviceTypes";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const INITIAL_CLIENT_DATA: CreateCustomerInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
};

export function CreateJobDialog({ open, onOpenChange }: CreateJobDialogProps) {
  const { user, currentAccount, isManager } = useAuth();
  const createCustomerMutation = useCreateCustomer();

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newClientData, setNewClientData] = useState<CreateCustomerInput>({ ...INITIAL_CLIENT_DATA });

  const [jobName, setJobName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<string>("");

  const createJob = useCreateJob();
  const createRecurringJob = useCreateRecurringJob();
  const addJobSchedule = useAddJobSchedule();

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
    enabled: !!currentAccount && isRecurring,
  });

  const resolveCustomer = async (): Promise<{ id: string; name: string; phone: string | null; email: string | null; address: string | null }> => {
    if (clientMode === "new") {
      const customer = await createCustomerMutation.mutateAsync({
        name: newClientData.name.trim(),
        phone: newClientData.phone?.trim() || null,
        email: newClientData.email?.trim() || null,
        address: newClientData.address?.trim() || null,
        city: newClientData.city?.trim() || null,
        forceNew: true,
      });

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      };
    }

    if (clientMode === "existing" && selectedCustomer) {
      return {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email,
        address: selectedCustomer.address,
      };
    }

    throw new Error("Please select a client or create a new one");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to create a job");
      return;
    }

    if (!currentAccount) {
      toast.error("No account selected");
      return;
    }

    if (clientMode === "new" && !newClientData.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (clientMode === "existing" && !selectedCustomer) {
      toast.error("Please select a client or create a new one");
      return;
    }

    const address = jobAddress || (clientMode === "existing" ? selectedCustomer?.address : newClientData.address) || "";
    if (!address.trim()) {
      toast.error("Job address is required");
      return;
    }

    setIsLoading(true);

    try {
      const customer = await resolveCustomer();

      if (isRecurring) {
        if (!scheduledDate) {
          toast.error("Start date is required for recurring jobs");
          setIsLoading(false);
          return;
        }

        await createRecurringJob.mutateAsync({
          customer_id: customer.id,
          name: jobName || customer.name,
          service_type: serviceType || null,
          address: jobAddress || customer.address || "",
          description: description || null,
          frequency,
          scheduled_time_start: scheduledTime || null,
          scheduled_time_end: scheduledTimeEnd || null,
          start_date: scheduledDate,
          end_date: hasEndDate && endDate ? endDate : null,
          default_crew_user_ids: selectedCrew,
          preferred_days_of_week: (frequency === "weekly" || frequency === "biweekly") ? selectedDaysOfWeek : [],
          preferred_day_of_month: frequency === "monthly" && selectedDayOfMonth ? parseInt(selectedDayOfMonth) : null,
        });

        toast.success("Job schedule created! A quote and client portal have been set up.");
      } else {
        const newJob = await createJob.mutateAsync({
          name: jobName || customer.name,
          customer_id: customer.id,
          phone: customer.phone,
          email: customer.email,
          service_type: serviceType || null,
          address: jobAddress || customer.address || "",
          description: description || null,
          status: "job",
        });

        if (scheduledDate) {
          await addJobSchedule.mutateAsync({
            lead_id: newJob.id,
            scheduled_date: scheduledDate,
            scheduled_time_start: scheduledTime || undefined,
            scheduled_time_end: undefined,
          });
        }

        toast.success("Job created successfully!");
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating job:", error);
      toast.error("Failed to create job. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setClientMode("existing");
    setSelectedCustomer(null);
    setNewClientData({ ...INITIAL_CLIENT_DATA });
    setJobName("");
    setServiceType("");
    setJobAddress("");
    setDescription("");
    setScheduledDate("");
    setScheduledTime("");
    setIsRecurring(false);
    setFrequency("weekly");
    setHasEndDate(false);
    setEndDate("");
    setScheduledTimeEnd("");
    setSelectedCrew([]);
    setSelectedDaysOfWeek([]);
    setSelectedDayOfMonth("");
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const toggleCrewMember = (userId: string) => {
    setSelectedCrew((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleDayOfWeek = (day: number) => {
    setSelectedDaysOfWeek((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <p className="text-5">Select a client and enter job details below.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ClientSelector
            selectedCustomer={selectedCustomer}
            onSelect={setSelectedCustomer}
            newClientData={newClientData}
            onNewClientDataChange={setNewClientData}
            mode={clientMode}
            onModeChange={setClientMode}
          />

          <div className="space-y-2">
            <Label htmlFor="jobName">
              Job Name
            </Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Smith Patio Project (optional)"

            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Job Details
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

            <div className="space-y-2">
              <Label htmlFor="serviceType">
                Service Type
              </Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger id="serviceType" className="h-12 text-base border-border rounded-lg">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobAddress" >
                Job Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="jobAddress"
                value={jobAddress}
                onChange={(e) => setJobAddress(e.target.value)}
                placeholder={
                  selectedCustomer?.address
                    ? `Default: ${selectedCustomer.address}`
                    : "123 Main St, Austin, TX"
                }

              />
              {selectedCustomer?.address && !jobAddress && (
                <p className="text-xs text-muted-foreground">
                  Will use client's address: {selectedCustomer.address}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" >
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Project scope and details..."

              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Scheduling
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

            <div className="flex items-center justify-between p-2 px-4 rounded-lg border border-border ">
              <div className="flex items-center gap-3 text-label">
                <Repeat className="h-4 w-4" />

                  <p>Create recurring schedule</p>

              </div>

              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            {isRecurring && (
              <div className="space-y-4 p-4 rounded-lg border border-gray-200">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={(v) => { setFrequency(v as RecurrenceFrequency); setSelectedDaysOfWeek([]); setSelectedDayOfMonth(""); }}>
                    <SelectTrigger className="h-12 text-base border-gray-300 rounded-lg">
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
                    <Label >
                      Days of the Week <span className="text-red-500">*</span>
                    </Label>
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
                    <Label >
                      Day of the Month <span className="text-red-500">*</span>
                    </Label>
                    <Select value={selectedDayOfMonth} onValueChange={setSelectedDayOfMonth}>
                      <SelectTrigger className="h-12 text-base border-gray-300 rounded-lg">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day === 1 ? "1st" : day === 2 ? "2nd" : day === 3 ? "3rd" : day === 21 ? "21st" : day === 22 ? "22nd" : day === 23 ? "23rd" : day === 31 ? "31st" : `${day}th`}
                          </SelectItem>
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
                    <Label>
                      Start Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="h-12 text-base border-gray-300 rounded-lg"
                      required={isRecurring}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label >End Date</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="hasEndDate"
                          checked={hasEndDate}
                          onCheckedChange={(checked) => setHasEndDate(checked === true)}
                        />
                        <label htmlFor="hasEndDate" className="text-sm text-gray-500 cursor-pointer">
                          Set end date
                        </label>
                      </div>
                    </div>
                    {hasEndDate ? (
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={scheduledDate}
                        className="h-12 text-base border-gray-300 rounded-lg"
                      />
                    ) : (
                      <div className="h-12 flex items-center px-3 text-sm text-gray-500 border border-gray-300 rounded-lg bg-gray-50">
                        Runs indefinitely
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-12 text-base border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={scheduledTimeEnd}
                      onChange={(e) => setScheduledTimeEnd(e.target.value)}
                      className="h-12 text-base border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-600" />
                    <Label >Default Crew</Label>
                  </div>
                  <p className="text-sm text-gray-500">
                    These crew members will be automatically assigned to each instance. You can change the crew on individual jobs later.
                  </p>
                  {crewMembers.length > 0 ? (
                    <div className="space-y-2">
                      {crewMembers.map((member: any) => (
                        <label
                          key={member.user_id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedCrew.includes(member.user_id)}
                            onCheckedChange={() => toggleCrewMember(member.user_id)}
                          />
                          <div>
                            <p className="font-medium text-gray-900">{member.full_name || member.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{member.role?.replace("_", " ")}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No crew members available</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isRecurring && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledDate" >
                  Scheduled Date
                </Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="h-12 text-base border-gray-300 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledTime" >
                  Scheduled Time
                </Label>
                <Input
                  id="scheduledTime"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-12 text-base border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? "Creating..." : isRecurring ? "Create Job Schedule" : "Create Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
