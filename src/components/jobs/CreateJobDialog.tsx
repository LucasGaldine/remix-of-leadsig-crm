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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Repeat, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientSelector } from "@/components/clients/ClientSelector";

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
    if (clientMode === "existing" && selectedCustomer) {
      return {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email,
        address: selectedCustomer.address,
      };
    }

    const customer = await createCustomerMutation.mutateAsync({
      name: newClientData.name.trim(),
      phone: newClientData.phone?.trim() || null,
      email: newClientData.email?.trim() || null,
      address: newClientData.address?.trim() || null,
      city: newClientData.city?.trim() || null,
    });

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    };
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
          name: jobName || null,
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
        let scheduledDateTime: string | null = null;
        if (scheduledDate) {
          scheduledDateTime = scheduledTime
            ? `${scheduledDate}T${scheduledTime}:00`
            : `${scheduledDate}T09:00:00`;
        }

        await createJob.mutateAsync({
          name: jobName || null,
          customer_id: customer.id,
          phone: customer.phone,
          email: customer.email,
          service_type: serviceType || null,
          address: jobAddress || customer.address || "",
          description: description || null,
          scheduled_date: scheduledDateTime,
          status: "job",
        });

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
          <DialogTitle className="text-2xl font-semibold">Create New Job</DialogTitle>
          <p className="text-gray-500 text-base">Select a client and enter job details below.</p>
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
            <Label htmlFor="jobName" className="text-base font-semibold text-gray-900">
              Job Name
            </Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Smith Patio Project (optional)"
              className="h-14 text-base border-2 border-gray-300 focus-visible:border-emerald-600 focus-visible:ring-0 rounded-xl"
            />
            <p className="text-sm text-gray-500">If left empty, the customer name will be used</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>

            <div className="space-y-2">
              <Label htmlFor="serviceType" className="text-base font-semibold text-gray-900">
                Service Type
              </Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger className="h-12 text-base border-gray-300 rounded-lg">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patio">Patio Installation</SelectItem>
                  <SelectItem value="deck">Deck Building</SelectItem>
                  <SelectItem value="fence">Fence Installation</SelectItem>
                  <SelectItem value="landscaping">Landscaping</SelectItem>
                  <SelectItem value="concrete">Concrete Work</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobAddress" className="text-base font-semibold text-gray-900">
                Job Address <span className="text-red-500">*</span>
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
                className="h-12 text-base border-gray-300 rounded-lg"
              />
              {selectedCustomer?.address && !jobAddress && (
                <p className="text-xs text-muted-foreground">
                  Will use client's address: {selectedCustomer.address}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold text-gray-900">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Project scope and details..."
                className="min-h-24 text-base border-gray-300 rounded-lg resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <Repeat className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-semibold text-gray-900">Job Schedule</p>
                  <p className="text-sm text-gray-500">Set up a recurring schedule with a shared quote and client portal</p>
                </div>
              </div>
              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            {isRecurring && (
              <div className="space-y-4 p-4 rounded-lg border border-gray-200">
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-900">Frequency</Label>
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
                    <Label className="text-base font-semibold text-gray-900">
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
                    <Label className="text-base font-semibold text-gray-900">
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
                    <Label className="text-base font-semibold text-gray-900">
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
                      <Label className="text-base font-semibold text-gray-900">End Date</Label>
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
                    <Label className="text-base font-semibold text-gray-900">Start Time</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-12 text-base border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-gray-900">End Time</Label>
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
                    <Label className="text-base font-semibold text-gray-900">Default Crew</Label>
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
                <Label htmlFor="scheduledDate" className="text-base font-semibold text-gray-900">
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
                <Label htmlFor="scheduledTime" className="text-base font-semibold text-gray-900">
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
              onClick={handleCancel}
              disabled={isLoading}
              className="px-8 h-12 text-base rounded-lg border-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="px-8 h-12 text-base bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              {isLoading ? "Creating..." : isRecurring ? "Create Job Schedule" : "Create Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
