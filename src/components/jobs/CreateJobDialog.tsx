import { useEffect, useMemo, useState } from "react";
import { Mic, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateJob, useDeleteJob } from "@/hooks/useJobs";
import { useCreateCustomer, type Customer, type CreateCustomerInput } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { ClientSelector } from "@/components/clients/ClientSelector";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { resolveCreateJobAddress } from "@/lib/createJobAddress";
import { buildDefaultJobName } from "@/lib/defaultJobName";
import { JobCSVImportModal } from "@/components/jobs/JobCSVImportModal";
import { useScheduleJob } from "@/hooks/useScheduleJob";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { type EstimateLineItem } from "@/components/leads/EstimateLineItemsEditor";
import { ScheduleDateBuilder, type ScheduleEntry } from "@/components/scheduling/ScheduleDateBuilder";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { buildMockCrewAssigneeId, parseCrewAssigneeId } from "@/lib/crewIdentifiers";
import { VoiceIntakePanel } from "@/components/voice/VoiceIntakePanel";
import { matchServiceType, normalizeVoiceEstimateParsedData, normalizeVoiceJobParsedData } from "@/lib/voiceIntake";
import type { VoiceEstimateParsedData, VoiceJobParsedData } from "@/types/voiceIntake";
import { useAddressVerification } from "@/hooks/useAddressVerification";
import { AddressVerificationBadge } from "@/components/address/AddressVerificationBadge";
import { CreateJobCrewAssignmentStep } from "@/components/jobs/CreateJobCrewAssignmentStep";
import { CreateJobEstimateStepContent } from "@/components/jobs/CreateJobEstimateStepContent";
import { createEstimateVersionSnapshot } from "@/lib/estimateVersions";
import { RecurrenceFrequency, useConvertToRecurring } from "@/hooks/useRecurringJobs";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated?: (jobId: string) => void;
}

const INITIAL_CLIENT_DATA: CreateCustomerInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
};

type ManualStep = "client" | "job-information" | "assign-and-schedule" | "crew-assignment" | "estimate-line-items";
type CrewConflictDetail = {
  jobTitle: string;
  scheduledDate: string;
  scheduledTimeStart: string | null;
  scheduledTimeEnd: string | null;
};
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MANUAL_STEPS: ManualStep[] = [
  "client",
  "job-information",
  "assign-and-schedule",
  "crew-assignment",
  "estimate-line-items",
];

const INITIAL_LINE_ITEM: EstimateLineItem = {
  name: "",
  description: "",
  quantity: "1",
  unit: "item",
  unit_price: "",
  category: "other",
};

export function CreateJobDialog({ open, onOpenChange, onJobCreated }: CreateJobDialogProps) {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();
  const createCustomerMutation = useCreateCustomer();
  const createJob = useCreateJob();
  const deleteJob = useDeleteJob();
  const convertToRecurring = useConvertToRecurring();
  const { scheduleJob } = useScheduleJob();
  const { data: crewMembers = [] } = useTeamMembers();
  const { verify, verifying, result: addressResult, reset: resetAddressVerification } = useAddressVerification();

  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showVoiceJobIntake, setShowVoiceJobIntake] = useState(false);
  const [showVoiceEstimateIntake, setShowVoiceEstimateIntake] = useState(false);
  const [manualStep, setManualStep] = useState<ManualStep>("client");

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newClientData, setNewClientData] = useState<CreateCustomerInput>({ ...INITIAL_CLIENT_DATA });

  const [jobName, setJobName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [description, setDescription] = useState("");
  const [addedSchedules, setAddedSchedules] = useState<ScheduleEntry[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"one-time" | "recurring">("one-time");
  const [recurringFrequency, setRecurringFrequency] = useState<RecurrenceFrequency>("weekly");
  const [crewByScheduleIndex, setCrewByScheduleIndex] = useState<Record<number, string[]>>({});
  const [crewConflictByMember, setCrewConflictByMember] = useState<Record<string, number[]>>({});
  const [crewConflictDetailsByMember, setCrewConflictDetailsByMember] = useState<
    Record<string, Record<number, CrewConflictDetail>>
  >({});
  const [crewSearchQuery, setCrewSearchQuery] = useState("");
  const [activeCrewId, setActiveCrewId] = useState<string>("");
  const [isLoadingCrewConflicts, setIsLoadingCrewConflicts] = useState(false);
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([{ ...INITIAL_LINE_ITEM }]);
  const [estimateVersionName, setEstimateVersionName] = useState("Version 1");
  const [profitMargin, setProfitMargin] = useState<string>("0");
  const [surcharge, setSurcharge] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const crewMemberIdsKey = crewMembers
    .map((member) => member.user_id)
    .sort()
    .join("|");
  const scheduleConflictKey = addedSchedules
    .map((schedule) => `${schedule.date}:${schedule.timeStart || ""}:${schedule.timeEnd || ""}`)
    .join("|");

  useEffect(() => {
    if (!open) return;
    setProfitMargin(String(currentAccount?.default_profit_margin ?? 0));
    setSurcharge(String(currentAccount?.default_surcharge ?? 0));
  }, [open, currentAccount?.default_profit_margin, currentAccount?.default_surcharge]);

  useEffect(() => {
    if (!open || manualStep !== "crew-assignment") return;

    if (!currentAccount?.id || addedSchedules.length === 0 || crewMembers.length === 0) {
      setCrewConflictByMember({});
      setCrewConflictDetailsByMember({});
      setIsLoadingCrewConflicts(false);
      return;
    }

    let isCancelled = false;

    const loadCrewConflicts = async () => {
      setIsLoadingCrewConflicts(true);

      const parsedCrew = crewMembers.map((member) => parseCrewAssigneeId(member.user_id));
      const realCrewIds = parsedCrew
        .filter((member) => member.type === "user" && member.userId)
        .map((member) => member.userId as string)
        .filter((id) => UUID_REGEX.test(id));
      const mockCrewIds = parsedCrew
        .filter((member) => member.type === "mock" && member.mockProfileId)
        .map((member) => member.mockProfileId as string)
        .filter((id) => UUID_REGEX.test(id));

      const assignmentRows: any[] = [];

      if (realCrewIds.length > 0) {
        const { data, error } = await supabase
          .from("job_assignments")
          .select("user_id, mock_crew_profile_id, job_schedules!inner(lead_id, scheduled_date, scheduled_time_start, scheduled_time_end)")
          .in("user_id", realCrewIds)
          .eq("account_id", currentAccount.id);

        if (isCancelled) return;
        if (error) {
          console.error("Error loading crew conflicts:", error);
          setCrewConflictByMember({});
          setCrewConflictDetailsByMember({});
          setIsLoadingCrewConflicts(false);
          return;
        }
        assignmentRows.push(...(data || []));
      }

      if (mockCrewIds.length > 0) {
        const { data, error } = await supabase
          .from("job_assignments")
          .select("user_id, mock_crew_profile_id, job_schedules!inner(lead_id, scheduled_date, scheduled_time_start, scheduled_time_end)")
          .in("mock_crew_profile_id", mockCrewIds)
          .eq("account_id", currentAccount.id);

        if (isCancelled) return;
        if (error) {
          console.error("Error loading crew conflicts:", error);
          setCrewConflictByMember({});
          setCrewConflictDetailsByMember({});
          setIsLoadingCrewConflicts(false);
          return;
        }
        assignmentRows.push(...(data || []));
      }

      const conflictMap: Record<string, number[]> = {};
      const conflictDetailsMap: Record<string, Record<number, CrewConflictDetail>> = {};
      for (const [scheduleIndex, schedule] of addedSchedules.entries()) {
        for (const assignment of assignmentRows) {
          const scheduleRows = Array.isArray((assignment as any).job_schedules)
            ? (assignment as any).job_schedules
            : [(assignment as any).job_schedules];

          for (const scheduleRow of scheduleRows) {
            if (!scheduleRow || scheduleRow.scheduled_date !== schedule.date) continue;

            const hasOverlap =
              !schedule.timeStart ||
              !schedule.timeEnd ||
              !scheduleRow.scheduled_time_start ||
              !scheduleRow.scheduled_time_end ||
              (
                schedule.timeStart < scheduleRow.scheduled_time_end &&
                schedule.timeEnd > scheduleRow.scheduled_time_start
              );

            if (!hasOverlap) continue;

            const crewId = (assignment as any).user_id
              || ((assignment as any).mock_crew_profile_id
                ? buildMockCrewAssigneeId((assignment as any).mock_crew_profile_id)
                : "");
            if (!crewId) continue;
            if (!conflictMap[crewId]) {
              conflictMap[crewId] = [];
            }
            if (!conflictMap[crewId].includes(scheduleIndex)) {
              conflictMap[crewId].push(scheduleIndex);
            }
            if (!conflictDetailsMap[crewId]) {
              conflictDetailsMap[crewId] = {};
            }
            if (!conflictDetailsMap[crewId][scheduleIndex]) {
              conflictDetailsMap[crewId][scheduleIndex] = {
                jobTitle: "Another job",
                scheduledDate: scheduleRow.scheduled_date,
                scheduledTimeStart: scheduleRow.scheduled_time_start,
                scheduledTimeEnd: scheduleRow.scheduled_time_end,
              };
            }
          }
        }
      }

      setCrewConflictByMember(conflictMap);
      setCrewConflictDetailsByMember(conflictDetailsMap);
      setCrewByScheduleIndex((current) => {
        let changed = false;
        const next: Record<number, string[]> = {};

        for (const [rawIndex, assignedCrewIds] of Object.entries(current)) {
          const scheduleIndex = Number(rawIndex);
          const filteredCrewIds = assignedCrewIds.filter(
            (crewId) => !(conflictMap[crewId] || []).includes(scheduleIndex),
          );

          if (filteredCrewIds.length !== assignedCrewIds.length) {
            changed = true;
          }

          if (filteredCrewIds.length > 0) {
            next[scheduleIndex] = filteredCrewIds;
          }
        }

        return changed ? next : current;
      });
      setActiveCrewId((current) => {
        if (!current) return current;
        const conflicts = conflictMap[current] || [];
        const unavailableForAllDays =
          addedSchedules.length > 0 && conflicts.length >= addedSchedules.length;
        return unavailableForAllDays ? "" : current;
      });
      setIsLoadingCrewConflicts(false);
    };

    void loadCrewConflicts();

    return () => {
      isCancelled = true;
    };
  }, [open, manualStep, currentAccount?.id, crewMemberIdsKey, scheduleConflictKey]);

  const resolveCustomer = async (): Promise<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  }> => {
    if (clientMode === "new") {
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

  const resetForm = () => {
    setManualStep("client");
    setClientMode("existing");
    setSelectedCustomer(null);
    setNewClientData({ ...INITIAL_CLIENT_DATA });
    setJobName("");
    setServiceType("");
    setJobAddress("");
    setDescription("");
    setAddedSchedules([]);
    setScheduleMode("one-time");
    setRecurringFrequency("weekly");
    setCrewByScheduleIndex({});
    setCrewConflictByMember({});
    setCrewConflictDetailsByMember({});
    setCrewSearchQuery("");
    setActiveCrewId("");
    setShowVoiceJobIntake(false);
    setShowVoiceEstimateIntake(false);
    setLineItems([{ ...INITIAL_LINE_ITEM }]);
    setEstimateVersionName("Version 1");
    setProfitMargin(String(currentAccount?.default_profit_margin ?? 0));
    setSurcharge(String(currentAccount?.default_surcharge ?? 0));
    resetAddressVerification();
  };

  const createManualJob = async () => {
    if (clientMode === "new" && !newClientData.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (clientMode === "existing" && !selectedCustomer) {
      toast.error("Please select a client or create a new one");
      return;
    }

    if (scheduleMode === "recurring" && addedSchedules.length === 0) {
      toast.error("Select at least one schedule date to create a recurring schedule");
      return;
    }

    setIsLoading(true);

    let createdJobId: string | null = null;

    try {
      const customer = await resolveCustomer();
      const resolvedAddress = resolveCreateJobAddress({
        jobAddress,
        customerAddress: customer.address,
      });

      const sanitizedItems = lineItems
        .map((item) => {
          const quantity = Number.parseFloat(item.quantity || "0");
          const unitPrice = Number.parseFloat(item.unit_price || "0");
          return {
            name: item.name.trim(),
            description: item.description.trim() || null,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            unit: item.unit.trim() || "item",
            unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0,
            category: item.category,
          };
        })
        .filter((item) => item.name.length > 0);

      const lineItemsSubtotal = sanitizedItems.reduce(
        (sum, item) => sum + (item.quantity * item.unitPrice),
        0,
      );
      const profitMarginPercent = Number.parseFloat(profitMargin) || 0;
      const surchargePercent = Number.parseFloat(surcharge) || 0;
      const taxRatePercent = currentAccount?.default_tax_rate ?? 0;
      const adjustedSubtotal = lineItemsSubtotal
        + (lineItemsSubtotal * (profitMarginPercent / 100))
        + (lineItemsSubtotal * (surchargePercent / 100));
      const estimatedValue = adjustedSubtotal + (adjustedSubtotal * (taxRatePercent / 100));

      const recurringStartScheduleIndex = scheduleMode === "recurring" && addedSchedules.length > 0
        ? addedSchedules.reduce((bestIndex, schedule, index) => {
            if (bestIndex === -1) return index;
            return schedule.date < addedSchedules[bestIndex].date ? index : bestIndex;
          }, -1)
        : -1;

      const schedulesForCreation = scheduleMode === "recurring" && recurringStartScheduleIndex >= 0
        ? [{ ...addedSchedules[recurringStartScheduleIndex], sourceIndex: recurringStartScheduleIndex }]
        : addedSchedules.map((schedule, sourceIndex) => ({ ...schedule, sourceIndex }));

      const proposedCrewAssignments = schedulesForCreation.flatMap((schedule) => {
        const selectedCrewForSchedule = crewByScheduleIndex[schedule.sourceIndex] || [];
        return selectedCrewForSchedule.map((crewId) => ({
          crewId,
          date: schedule.date,
          timeStart: schedule.timeStart || null,
          timeEnd: schedule.timeEnd || null,
        }));
      });

      const recurringDefaultCrewUserIds = scheduleMode === "recurring" && recurringStartScheduleIndex >= 0
        ? Array.from(
            new Set(
              (crewByScheduleIndex[recurringStartScheduleIndex] || [])
                .map((crewId) => parseCrewAssigneeId(crewId))
                .filter((crew) => crew.type === "user" && crew.userId)
                .map((crew) => crew.userId as string),
            ),
          )
        : [];

      const recurringStartSchedule = recurringStartScheduleIndex >= 0
        ? addedSchedules[recurringStartScheduleIndex]
        : null;

      if (proposedCrewAssignments.length > 0) {
        if (!currentAccount?.id) {
          throw new Error("Crew assignment could not be validated.");
        }

        const uniqueCrewIds = Array.from(new Set(proposedCrewAssignments.map((assignment) => assignment.crewId)));
        const parsedCrewIds = uniqueCrewIds.map((crewId) => parseCrewAssigneeId(crewId));
        const realCrewIds = parsedCrewIds
          .filter((crew) => crew.type === "user" && crew.userId)
          .map((crew) => crew.userId as string)
          .filter((id) => UUID_REGEX.test(id));
        const mockCrewIds = parsedCrewIds
          .filter((crew) => crew.type === "mock" && crew.mockProfileId)
          .map((crew) => crew.mockProfileId as string)
          .filter((id) => UUID_REGEX.test(id));
        const existingAssignments: any[] = [];

        if (realCrewIds.length > 0) {
          const { data, error } = await supabase
            .from("job_assignments")
            .select("user_id, mock_crew_profile_id, job_schedules!inner(scheduled_date, scheduled_time_start, scheduled_time_end)")
            .in("user_id", realCrewIds)
            .eq("account_id", currentAccount.id);

          if (error) throw error;
          existingAssignments.push(...(data || []));
        }

        if (mockCrewIds.length > 0) {
          const { data, error } = await supabase
            .from("job_assignments")
            .select("user_id, mock_crew_profile_id, job_schedules!inner(scheduled_date, scheduled_time_start, scheduled_time_end)")
            .in("mock_crew_profile_id", mockCrewIds)
            .eq("account_id", currentAccount.id);

          if (error) throw error;
          existingAssignments.push(...(data || []));
        }

        for (const proposedAssignment of proposedCrewAssignments) {
          const parsedProposedCrew = parseCrewAssigneeId(proposedAssignment.crewId);
          const matchingAssignments = (existingAssignments || []).filter(
            (assignment: any) =>
              (parsedProposedCrew.type === "user" && assignment.user_id === parsedProposedCrew.userId) ||
              (parsedProposedCrew.type === "mock" && assignment.mock_crew_profile_id === parsedProposedCrew.mockProfileId),
          );

          for (const assignment of matchingAssignments) {
            const scheduleRows = Array.isArray(assignment.job_schedules)
              ? assignment.job_schedules
              : [assignment.job_schedules];

            for (const scheduleRow of scheduleRows) {
              if (!scheduleRow || scheduleRow.scheduled_date !== proposedAssignment.date) continue;

              const hasOverlap =
                !proposedAssignment.timeStart ||
                !proposedAssignment.timeEnd ||
                !scheduleRow.scheduled_time_start ||
                !scheduleRow.scheduled_time_end ||
                (
                  proposedAssignment.timeStart < scheduleRow.scheduled_time_end &&
                  proposedAssignment.timeEnd > scheduleRow.scheduled_time_start
                );

              if (!hasOverlap) continue;

              const crewMember = crewMembers.find((member) => member.user_id === proposedAssignment.crewId);
              const crewName = crewMember?.full_name || crewMember?.email || "This crew member";
              const [year, month, day] = proposedAssignment.date.split("-").map(Number);
              const localDate = new Date(year, month - 1, day);
              const dateLabel = format(localDate, "EEEE, MMMM d, yyyy");

              throw new Error(
                `${crewName} is already assigned to another job on ${dateLabel}. Please choose a different date, time, or crew member.`,
              );
            }
          }
        }
      }

      const createdJob = await createJob.mutateAsync({
        name: jobName.trim() || buildDefaultJobName({
          customerName: customer.name,
          serviceType,
        }),
        customer_id: customer.id,
        phone: customer.phone,
        email: customer.email,
        service_type: serviceType || null,
        address: resolvedAddress,
        description: description || null,
        estimated_value: sanitizedItems.length > 0 ? Number(estimatedValue.toFixed(2)) : null,
        status: "job",
      });
      createdJobId = createdJob.id;

      const createdSchedules: Array<{ scheduleId: string; sourceIndex: number }> = [];

      for (const schedule of schedulesForCreation) {
        const scheduleResult = await scheduleJob({
          leadId: createdJob.id,
          scheduledDate: schedule.date,
          startTime: schedule.timeStart || undefined,
          endTime: schedule.timeEnd || undefined,
          suppressSuccessToast: true,
          suppressErrorToast: true,
        });
        if (scheduleResult.scheduleId) {
          createdSchedules.push({ scheduleId: scheduleResult.scheduleId, sourceIndex: schedule.sourceIndex });
        } else {
          const reason = scheduleResult.error?.message?.trim() || `Schedule ${schedule.date} could not be saved.`;
          throw new Error(reason);
        }
      }

      const assignmentsToInsert = createdSchedules.flatMap(({ scheduleId, sourceIndex }) => {
        const selectedCrewForSchedule = crewByScheduleIndex[sourceIndex] || [];
        return selectedCrewForSchedule.map((crewId) => {
          const parsedCrew = parseCrewAssigneeId(crewId);
          return {
            lead_id: createdJob.id,
            user_id: parsedCrew.type === "user" ? parsedCrew.userId : null,
            mock_crew_profile_id: parsedCrew.type === "mock" ? parsedCrew.mockProfileId : null,
            job_schedule_id: scheduleId,
            account_id: currentAccount?.id,
            assigned_by: user?.id,
          };
        });
      });

      if (assignmentsToInsert.length > 0) {
        if (!currentAccount?.id || !user?.id) {
          throw new Error("Crew assignment could not be completed.");
        } else {
          const { error: assignmentError } = await supabase
            .from("job_assignments")
            .insert(assignmentsToInsert as any);

          if (assignmentError) {
            console.error("Error assigning crew:", assignmentError);
            if (
              assignmentError.message?.includes("row-level security") ||
              assignmentError.message?.includes("policy")
            ) {
              throw new Error(
                "One or more crew members are already assigned to another job at that time. Please adjust crew or schedule.",
              );
            }
            throw new Error(assignmentError.message || "Crew assignment could not be completed.");
          }
        }
      }

      if (sanitizedItems.length > 0) {
        if (!currentAccount?.id || !user?.id) {
          throw new Error("Estimate details could not be saved.");
        } else {
          const estimateSubtotal = Number(lineItemsSubtotal.toFixed(2));
          const profitAmount = estimateSubtotal * (profitMarginPercent / 100);
          const surchargeAmount = estimateSubtotal * (surchargePercent / 100);
          const subtotalAfterAdjustments = estimateSubtotal + profitAmount + surchargeAmount;
          const taxRate = taxRatePercent / 100;
          const taxAmount = subtotalAfterAdjustments * taxRate;
          const estimateTotal = subtotalAfterAdjustments + taxAmount;

          const { data: existingEstimate, error: existingEstimateError } = await supabase
            .from("estimates")
            .select("id")
            .eq("job_id", createdJob.id)
            .maybeSingle();

          if (existingEstimateError) throw existingEstimateError;

          let estimateId = existingEstimate?.id as string | undefined;

          if (estimateId) {
            const { error: estimateUpdateError } = await supabase
              .from("estimates")
              .update({
                customer_id: customer.id,
                subtotal: estimateSubtotal,
                profit_margin: profitMarginPercent,
                surcharge: surchargePercent,
                tax_rate: taxRate,
                tax: taxAmount,
                discount: 0,
                total: estimateTotal,
                status: "draft",
              })
              .eq("id", estimateId);

            if (estimateUpdateError) throw estimateUpdateError;

            const { error: deleteEstimateLineItemsError } = await supabase
              .from("estimate_line_items")
              .delete()
              .eq("estimate_id", estimateId);

            if (deleteEstimateLineItemsError) throw deleteEstimateLineItemsError;
          } else {
            const { data: estimateData, error: estimateInsertError } = await supabase
              .from("estimates")
              .insert({
                customer_id: customer.id,
                job_id: createdJob.id,
                subtotal: estimateSubtotal,
                profit_margin: profitMarginPercent,
                surcharge: surchargePercent,
                tax_rate: taxRate,
                tax: taxAmount,
                discount: 0,
                total: estimateTotal,
                status: "draft",
                created_by: user.id,
                account_id: currentAccount.id,
              })
              .select()
              .single();

            if (estimateInsertError) throw estimateInsertError;
            estimateId = estimateData.id;
          }

          const { error: estimateLineItemsError } = await supabase
            .from("estimate_line_items")
            .insert(
              sanitizedItems.map((item, index) => ({
                estimate_id: estimateId,
                account_id: currentAccount.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unitPrice,
                total: Number((item.quantity * item.unitPrice).toFixed(2)),
                sort_order: index,
                category: item.category,
              })),
            );

          if (estimateLineItemsError) throw estimateLineItemsError;

          const initialVersionName = estimateVersionName.trim() || "Version 1";
          await createEstimateVersionSnapshot({
            estimateId,
            accountId: currentAccount.id,
            name: initialVersionName,
            subtotal: estimateSubtotal,
            taxRate: taxRate,
            tax: taxAmount,
            discount: 0,
            total: estimateTotal,
            profitMargin: profitMarginPercent,
            surcharge: surchargePercent,
            notes: null,
            lineItems: sanitizedItems.map((item, index) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unitPrice,
              total: Number((item.quantity * item.unitPrice).toFixed(2)),
              sort_order: index,
              category: item.category,
            })),
          });
        }
      }

      if (scheduleMode === "recurring" && recurringStartSchedule) {
        const [year, month, day] = recurringStartSchedule.date.split("-").map(Number);
        const localDate = new Date(year, month - 1, day);
        const recurringInput = {
          jobId: createdJob.id,
          frequency: recurringFrequency,
          start_date: recurringStartSchedule.date,
          scheduled_time_start: recurringStartSchedule.timeStart || null,
          scheduled_time_end: recurringStartSchedule.timeEnd || null,
          preferred_days_of_week: (
            recurringFrequency === "weekly" || recurringFrequency === "biweekly"
          ) ? [localDate.getDay()] : [],
          preferred_day_of_month: recurringFrequency === "monthly" ? localDate.getDate() : null,
          default_crew_user_ids: recurringDefaultCrewUserIds,
        } satisfies Parameters<typeof convertToRecurring.mutateAsync>[0];

        await convertToRecurring.mutateAsync(recurringInput);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["job-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["job", createdJob.id] }),
        queryClient.invalidateQueries({ queryKey: ["job-assignments", createdJob.id] }),
        queryClient.invalidateQueries({ queryKey: ["job-schedules", createdJob.id] }),
        queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] }),
      ]);

      toast.success("Job created successfully!");
      resetForm();
      onOpenChange(false);
      onJobCreated?.(createdJob.id);
    } catch (error) {
      console.error("Error creating job:", error);
      if (createdJobId) {
        try {
          await deleteJob.mutateAsync(createdJobId);
        } catch (rollbackError) {
          console.error("Error rolling back failed job creation:", rollbackError);
          toast.error("Failed to create job and could not roll back the partial record. Please remove it manually.");
          return;
        }
      }

      const message = error instanceof Error && error.message
        ? error.message
        : "Please try again.";
      toast.error(`Failed to create job. ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStepIndex = MANUAL_STEPS.indexOf(manualStep);
  const isFinalStep = manualStep === "estimate-line-items";
  const canContinueFromClientStep =
    (clientMode === "existing" && Boolean(selectedCustomer)) ||
    (clientMode === "new" && newClientData.name.trim().length > 0);

  const goToNextStep = () => {
    if (manualStep === "client" && !canContinueFromClientStep) {
      return;
    }
    const nextIndex = Math.min(currentStepIndex + 1, MANUAL_STEPS.length - 1);
    setManualStep(MANUAL_STEPS[nextIndex]);
  };

  const goToPreviousStep = () => {
    const previousIndex = Math.max(currentStepIndex - 1, 0);
    setManualStep(MANUAL_STEPS[previousIndex]);
  };

  const handleSkipAndCreate = () => {
    if (manualStep === "client" && !canContinueFromClientStep) {
      return;
    }
    void createManualJob();
  };

  const toggleCrewSelectionForSchedule = (scheduleIndex: number, crewId: string) => {
    setCrewByScheduleIndex((current) => {
      const existing = current[scheduleIndex] || [];
      const nextForSchedule = existing.includes(crewId)
        ? existing.filter((id) => id !== crewId)
        : [...existing, crewId];

      return {
        ...current,
        [scheduleIndex]: nextForSchedule,
      };
    });
  };

  const filteredCrewMembers = crewMembers.filter((member) => {
    if (!crewSearchQuery.trim()) return true;
    const query = crewSearchQuery.toLowerCase();
    return (
      (member.full_name || "").toLowerCase().includes(query) ||
      (member.email || "").toLowerCase().includes(query)
    );
  });

  const isCrewConflictedOnDay = (scheduleIndex: number, crewId: string) => {
    return (crewConflictByMember[crewId] || []).includes(scheduleIndex);
  };

  const isCrewUnavailableForSelectedSchedules = (crewId: string) => {
    return addedSchedules.length > 0
      && addedSchedules.every((_, scheduleIndex) => isCrewConflictedOnDay(scheduleIndex, crewId));
  };

  const toggleSelectedCrewDay = (scheduleIndex: number) => {
    if (!activeCrewId) return;
    if (isCrewConflictedOnDay(scheduleIndex, activeCrewId)) return;
    toggleCrewSelectionForSchedule(scheduleIndex, activeCrewId);
  };

  const isCrewAssignedToDay = (scheduleIndex: number, crewId: string) => {
    return (crewByScheduleIndex[scheduleIndex] || []).includes(crewId);
  };

  const applyVoiceJobIntake = (parsedData: VoiceJobParsedData) => {
    const parsed = normalizeVoiceJobParsedData(parsedData);

    setClientMode("new");
    setSelectedCustomer(null);
    setNewClientData((current) => ({
      ...current,
      name: parsed.customerName || current.name,
      phone: parsed.customerPhone || current.phone || "",
      email: parsed.customerEmail || current.email || "",
      address: parsed.customerAddress || current.address || "",
    }));

    setJobName((current) => parsed.jobName || current);
    setServiceType((current) => matchServiceType(parsed.serviceType, SERVICE_TYPES) || current);
    setJobAddress((current) => parsed.jobAddress || current);
    resetAddressVerification();
    setDescription((current) => parsed.description || current);
    setShowVoiceJobIntake(false);
  };

  const applyVoiceEstimateIntake = (parsedData: VoiceEstimateParsedData) => {
    const parsed = normalizeVoiceEstimateParsedData(parsedData);
    const parsedLineItems = (parsed.lineItems || [])
      .map((item) => {
        const name = (item.name || "").trim();
        if (!name) return null;
        return {
          name,
          description: item.description || "",
          quantity: String(item.quantity ?? 1),
          unit: item.unit || "item",
          unit_price: String(item.unitPrice ?? 0),
          category: "other" as const,
        };
      })
      .filter((item): item is EstimateLineItem => item !== null);

    if (parsedLineItems.length > 0) {
      setLineItems(parsedLineItems);
    }
  };

  const addressToVerify = resolveCreateJobAddress({
    jobAddress,
    customerAddress: selectedCustomer?.address,
  });

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const stepTitle = (() => {
    if (manualStep === "client") return "Create New Job";
    if (manualStep === "job-information") return "Job Information";
    if (manualStep === "assign-and-schedule") return "Scheduling";
    if (manualStep === "crew-assignment") return "Assign Crew";
    return "Estimate Line Items";
  })();

  const estimateEditorDraft = useMemo(() => {
    const taxRate = (currentAccount?.default_tax_rate ?? 0) / 100;
    const normalizedLineItems = lineItems
      .map((item, index) => {
        const quantity = Number.parseFloat(item.quantity || "0") || 0;
        const unitPrice = Number.parseFloat(item.unit_price || "0") || 0;
        return {
          id: `draft-item-${index}`,
          name: item.name,
          description: item.description || "",
          quantity,
          unit: item.unit || "item",
          unit_price: unitPrice,
          total: Number((quantity * unitPrice).toFixed(2)),
          sort_order: index,
          category: item.category || "other",
          is_change_order: false,
          change_order_type: null,
          change_order_approved: null,
        };
      })
      .filter((item) => item.name.trim().length > 0);

    const subtotal = normalizedLineItems.reduce((sum, item) => sum + item.total, 0);
    const profitMarginValue = (Number.parseFloat(profitMargin || "0") || 0) / 100;
    const surchargeValue = (Number.parseFloat(surcharge || "0") || 0) / 100;
    const adjustedSubtotal = subtotal + (subtotal * profitMarginValue) + (subtotal * surchargeValue);
    const tax = adjustedSubtotal * taxRate;
    const total = adjustedSubtotal + tax;

    return {
      account_id: currentAccount?.id,
      status: "draft",
      line_items: normalizedLineItems,
      tax_rate: taxRate,
      discount: 0,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      profit_margin: Number.parseFloat(profitMargin || "0") || 0,
      surcharge: Number.parseFloat(surcharge || "0") || 0,
    };
  }, [currentAccount?.default_tax_rate, currentAccount?.id, lineItems, profitMargin, surcharge]);

  return (
    <>
      <JobCSVImportModal
        open={showCSVImport}
        onOpenChange={setShowCSVImport}
      />

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{stepTitle}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Step {currentStepIndex + 1} of {MANUAL_STEPS.length}
            </p>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {manualStep === "client" && (
              <div className="space-y-6">
                <div className={`mt-2 grid gap-2 ${showVoiceJobIntake ? "grid-cols-1" : "grid-cols-2"}`}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      resetForm();
                      onOpenChange(false);
                      setShowCSVImport(true);
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    Import from CSV
                  </Button>
                  {!showVoiceJobIntake && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowVoiceJobIntake(true)}
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Voice Job Intake
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Or add manually
                  </span>
                  <div className="h-px bg-border flex-1" />
                </div>

                {!showVoiceJobIntake ? (
                  <>
                    <ClientSelector
                      selectedCustomer={selectedCustomer}
                      onSelect={setSelectedCustomer}
                      newClientData={newClientData}
                      onNewClientDataChange={setNewClientData}
                      mode={clientMode}
                      onModeChange={setClientMode}
                    />
                  </>
                ) : (
                  <div className="space-y-3">
                    <VoiceIntakePanel
                      entityType="job"
                      title="Voice Job Intake"
                      description="Speak customer and job details in one pass. Required details trigger follow-up questions before values are applied."
                      transcriptPlaceholder="Example: Create a job for Mike Carter, phone 555-333-1212, email mike@home.com, at 48 Pine Lane for gutter cleaning and roof wash..."
                      variant="plain"
                      onApply={(parsed) => applyVoiceJobIntake(parsed as VoiceJobParsedData)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowVoiceJobIntake(false)}
                    >
                      Back to Manual Form
                    </Button>
                  </div>
                )}
              </div>
            )}

            {manualStep === "job-information" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jobName">Job Name</Label>
                  <Input
                    id="jobName"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Smith Patio Project"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Type</Label>
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
                  <Label htmlFor="jobAddress">Job Address</Label>
                  <Input
                    id="jobAddress"
                    value={jobAddress}
                    onChange={(e) => {
                      setJobAddress(e.target.value);
                      resetAddressVerification();
                    }}
                    placeholder={selectedCustomer?.address ? `Default: ${selectedCustomer.address}` : "123 Main St, Austin, TX"}
                  />
                  <AddressVerificationBadge
                    verifying={verifying}
                    result={addressResult}
                    onVerify={() => {
                      if (!addressToVerify) return;
                      void verify(addressToVerify);
                    }}
                    onAccept={(formatted) => setJobAddress(formatted)}
                  />
                  {selectedCustomer?.address && !jobAddress && (
                    <p className="text-xs text-muted-foreground">
                      Will use client's address: {selectedCustomer.address}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Project scope and details..."
                  />
                </div>
              </div>
            )}

            {manualStep === "assign-and-schedule" && (
              <div className="space-y-4">
                <ScheduleDateBuilder
                  schedules={addedSchedules}
                  onSchedulesChange={setAddedSchedules}
                  recurringControls={(
                    <div className="space-y-2">
                      <div className="relative grid grid-cols-2 rounded-full border border-border bg-muted p-1">
                        <div className="pointer-events-none absolute inset-1 grid grid-cols-2 gap-1">
                          {scheduleMode === "one-time" ? (
                            <>
                              <div className="rounded-full bg-background shadow-sm" />
                              <div />
                            </>
                          ) : (
                            <>
                              <div />
                              <div className="rounded-full bg-background shadow-sm" />
                            </>
                          )}
                        </div>
                        {scheduleMode === "one-time" ? (
                          <>
                            <div className="relative z-10 flex h-9 items-center justify-center rounded-full text-sm font-medium text-foreground">
                              One Off
                            </div>
                            <button
                              type="button"
                              className="relative z-10 h-9 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground"
                              onClick={() => setScheduleMode("recurring")}
                            >
                              Recurring
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="relative z-10 h-9 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground"
                              onClick={() => setScheduleMode("one-time")}
                            >
                              One Off
                            </button>
                            <div className="relative z-10 flex h-9 items-center justify-center rounded-full text-sm font-medium text-foreground">
                              Recurring
                            </div>
                          </>
                        )}
                      </div>

                      {scheduleMode === "recurring" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={recurringFrequency}
                            onValueChange={(value) => setRecurringFrequency(value as RecurrenceFrequency)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            The earliest date you add will become the recurring start date.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
            )}

            {manualStep === "crew-assignment" && (
              <CreateJobCrewAssignmentStep
                addedSchedules={addedSchedules}
                crewMembers={crewMembers}
                assignedCrewByScheduleIndex={crewByScheduleIndex}
                filteredCrewMembers={filteredCrewMembers}
                crewSearchQuery={crewSearchQuery}
                onCrewSearchQueryChange={setCrewSearchQuery}
                activeCrewId={activeCrewId}
                onActiveCrewIdChange={setActiveCrewId}
                crewConflictByMember={crewConflictByMember}
                isLoadingCrewConflicts={isLoadingCrewConflicts}
                isCrewUnavailableForSelectedSchedules={isCrewUnavailableForSelectedSchedules}
                isCrewAssignedToDay={isCrewAssignedToDay}
                isCrewConflictedOnDay={isCrewConflictedOnDay}
                getCrewConflictDetail={(scheduleIndex, crewId) =>
                  crewConflictDetailsByMember[crewId]?.[scheduleIndex] || null
                }
                onToggleSelectedCrewDay={toggleSelectedCrewDay}
              />
            )}

            {manualStep === "estimate-line-items" && (
              <CreateJobEstimateStepContent
                open={open && manualStep === "estimate-line-items"}
                showVoiceEstimateIntake={showVoiceEstimateIntake}
                estimateEditorDraft={estimateEditorDraft}
                estimateVersionName={estimateVersionName}
                onShowVoiceEstimateIntake={() => setShowVoiceEstimateIntake(true)}
                onHideVoiceEstimateIntake={() => setShowVoiceEstimateIntake(false)}
                onEstimateVersionNameChange={setEstimateVersionName}
                onDraftChange={({ lineItems: updatedLineItems, profitMargin: updatedProfitMargin, surcharge: updatedSurcharge }) => {
                  setLineItems(
                    updatedLineItems.map((item) => ({
                      name: item.name,
                      description: item.description || "",
                      quantity: item.quantity || "1",
                      unit: item.unit || "item",
                      unit_price: item.unit_price || "0",
                      category: item.category || "other",
                    })),
                  );
                  setProfitMargin(updatedProfitMargin);
                  setSurcharge(updatedSurcharge);
                }}
                onApplyVoiceEstimateIntake={applyVoiceEstimateIntake}
              />
            )}
          </div>

          <DialogFooter className="pt-3 mt-3 border-t">
            <div className="flex w-full items-center justify-between gap-2">
              <div>
                {!isFinalStep && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSkipAndCreate}
                    disabled={isLoading || (manualStep === "client" && !canContinueFromClientStep)}
                  >
                    Skip & Create
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {manualStep !== "client" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={goToPreviousStep}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                )}
                {!isFinalStep ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={goToNextStep}
                    disabled={isLoading || (manualStep === "client" && !canContinueFromClientStep)}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={createManualJob}
                    disabled={isLoading || showVoiceEstimateIntake}
                  >
                    {isLoading ? "Creating..." : "Create Job"}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}
