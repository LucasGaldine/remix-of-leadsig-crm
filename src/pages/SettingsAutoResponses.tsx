import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Mail, Pencil, Plus, Save, Trash2, X, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { PlanGate } from "@/components/features/PlanGate";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleEmailConnection } from "@/hooks/useGoogleEmailConnection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TEMPLATE_VARIABLES = [
  "{{job_name}}",
  "{{client_name}}",
  "{{first_name}}",
  "{{service_type}}",
  "{{job_status}}",
  "{{lead_id}}",
  "{{scheduled_date}}",
  "{{scheduled_time}}",
  "{{scheduled_datetime}}",
] as const;
type OffsetUnit = "seconds" | "hours" | "days" | "months";
type DeliveryChannel = "text" | "email" | "both";
type PaymentEmailKey = "estimate_approved" | "invoice_sent" | "payment_logged";

const OFFSET_UNITS: OffsetUnit[] = ["seconds", "hours", "days", "months"];
const DEFAULT_PAYMENT_EMAILS: Record<PaymentEmailKey, boolean> = {
  estimate_approved: true,
  invoice_sent: true,
  payment_logged: true,
};

const offsetToMinutes = (offsetValue: number, offsetUnit: OffsetUnit): number => {
  if (!Number.isFinite(offsetValue) || offsetValue <= 0) return 0;
  if (offsetUnit === "seconds") return Math.floor(offsetValue / 60);
  if (offsetUnit === "hours") return offsetValue * 60;
  if (offsetUnit === "days") return offsetValue * 24 * 60;
  return offsetValue * 30 * 24 * 60;
};

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

export default function SettingsAutoResponses() {
  const { currentAccount } = useAuth();
  const { settings, updateSettingsAsync, isSaving } = useAccountSettings();
  const googleEmailConnection = useGoogleEmailConnection();
  const isFreePlan = currentAccount?.pricing_plan === "free";

  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);

  const [leadMessageAutomationEnabled, setLeadMessageAutomationEnabled] = useState(false);
  const [jobMessageAutomationEnabled, setJobMessageAutomationEnabled] = useState(false);
  const [jobMessageTemplateDraft, setJobMessageTemplateDraft] = useState("");
  const [jobMessageTemplateName, setJobMessageTemplateName] = useState("");
  const [jobMessageTemplates, setJobMessageTemplates] = useState<Array<{
    id: string;
    name: string;
    content: string;
    is_finished: boolean;
    delivery_channel: DeliveryChannel;
    job_service_types: string[];
    trigger: {
      type: "immediate" | "before_schedule_start" | "after_schedule_start" | "after_job_completion";
      offset_value: number;
      offset_unit: OffsetUnit;
    };
  }>>([]);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draftServiceTypes, setDraftServiceTypes] = useState<string[]>([]);
  const [draftTriggerType, setDraftTriggerType] = useState<"immediate" | "before_schedule_start" | "after_schedule_start" | "after_job_completion">("immediate");
  const [draftOffsetValue, setDraftOffsetValue] = useState("0");
  const [draftOffsetUnit, setDraftOffsetUnit] = useState<OffsetUnit>("days");
  const [draftDeliveryChannel, setDraftDeliveryChannel] = useState<DeliveryChannel>("text");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioFromNumber, setTwilioFromNumber] = useState("");
  const [testMessageModalOpen, setTestMessageModalOpen] = useState(false);
  const [testMessagePhoneNumber, setTestMessagePhoneNumber] = useState("");
  const [leadTestMessageModalOpen, setLeadTestMessageModalOpen] = useState(false);
  const [leadTestMessagePhoneNumber, setLeadTestMessagePhoneNumber] = useState("");
  const [isSendingTestMessage, setIsSendingTestMessage] = useState(false);
  const [isSendingLeadTestMessage, setIsSendingLeadTestMessage] = useState(false);
  const [serviceTypePopoverOpen, setServiceTypePopoverOpen] = useState(false);
  const [paymentEmails, setPaymentEmails] = useState<Record<PaymentEmailKey, boolean>>(DEFAULT_PAYMENT_EMAILS);

  useEffect(() => {
    const leadAutomation = settings?.lead_message_automation ?? null;
    const automation = settings?.job_message_automation ?? null;
    const legacyServiceTypes = Array.isArray(automation?.job_service_types)
      ? automation.job_service_types.filter((value): value is string => typeof value === "string")
      : [];
    const legacyTriggerType =
      automation?.trigger?.type === "before_schedule_start"
      || automation?.trigger?.type === "after_schedule_start"
      || automation?.trigger?.type === "after_job_completion"
        ? automation.trigger.type
        : "immediate";
    const legacyOffsetMinutes = typeof automation?.trigger?.offset_minutes === "number" ? automation.trigger.offset_minutes : 0;
    const legacyOffsetUnit: OffsetUnit = automation?.trigger?.offset_unit === "seconds"
      || automation?.trigger?.offset_unit === "hours"
      || automation?.trigger?.offset_unit === "days"
      || automation?.trigger?.offset_unit === "months"
      ? automation.trigger.offset_unit
      : typeof automation?.trigger?.offset_minutes === "number"
        ? "seconds"
        : "days";
    const legacyOffsetValue = typeof automation?.trigger?.offset_value === "number"
      ? Math.max(0, automation.trigger.offset_value)
      : legacyOffsetUnit === "seconds"
        ? Math.max(0, legacyOffsetMinutes * 60)
        : Math.max(0, legacyOffsetMinutes);

    const configuredTemplates = Array.isArray(automation?.message_templates)
      ? automation.message_templates
        .map((template, index) => {
          const content = typeof template?.content === "string" ? template.content.trim() : "";
          if (!content) return null;
          const deliveryChannel: DeliveryChannel =
            template?.delivery_channel === "email" || template?.delivery_channel === "both" || template?.delivery_channel === "text"
              ? template.delivery_channel
              : template?.send_email === true && template?.send_text === true
                ? "both"
                : template?.send_email === true
                  ? "email"
                  : "text";
          return {
            id: typeof template?.id === "string" && template.id.trim().length > 0 ? template.id : `template-${index + 1}`,
            name: typeof template?.name === "string" && template.name.trim().length > 0 ? template.name : `Template ${index + 1}`,
            content,
            is_finished: template?.is_finished !== false,
            delivery_channel: deliveryChannel,
            job_service_types: Array.isArray(template?.job_service_types)
              ? template.job_service_types.filter((value): value is string => typeof value === "string")
              : legacyServiceTypes,
            trigger: {
              type:
                template?.trigger?.type === "before_schedule_start"
                || template?.trigger?.type === "after_schedule_start"
                || template?.trigger?.type === "after_job_completion"
                  ? template.trigger.type
                  : legacyTriggerType,
              offset_unit:
                template?.trigger?.offset_unit === "seconds"
                  || template?.trigger?.offset_unit === "hours"
                  || template?.trigger?.offset_unit === "days"
                  || template?.trigger?.offset_unit === "months"
                  ? template.trigger.offset_unit
                  : typeof template?.trigger?.offset_minutes === "number"
                    ? "seconds"
                    : legacyOffsetUnit,
              offset_value:
                typeof template?.trigger?.offset_value === "number" && template.trigger.offset_value >= 0
                  ? template.trigger.offset_value
                  : typeof template?.trigger?.offset_minutes === "number" && template.trigger.offset_minutes >= 0
                    ? template.trigger.offset_minutes * 60
                    : legacyOffsetValue,
            },
          };
        })
        .filter((template): template is {
          id: string;
          name: string;
          content: string;
          is_finished: boolean;
          delivery_channel: DeliveryChannel;
          job_service_types: string[];
          trigger: { type: "immediate" | "before_schedule_start" | "after_schedule_start" | "after_job_completion"; offset_value: number; offset_unit: OffsetUnit };
        } => template !== null)
      : [];
    const legacyTemplate = typeof automation?.message_template === "string" ? automation.message_template.trim() : "";

    setLeadMessageAutomationEnabled(isFreePlan ? false : leadAutomation?.enabled === true);
    setJobMessageAutomationEnabled(isFreePlan ? false : automation?.enabled === true);
    setJobMessageTemplates(
      isFreePlan
        ? []
        :
      configuredTemplates.length > 0
        ? configuredTemplates
        : legacyTemplate
          ? [{
            id: "template-1",
            name: "Template 1",
            content: legacyTemplate,
            is_finished: true,
            delivery_channel: "text",
            job_service_types: legacyServiceTypes,
            trigger: {
              type: legacyTriggerType,
              offset_value: legacyOffsetValue,
              offset_unit: legacyOffsetUnit,
            },
          }]
          : [],
    );
    setJobMessageTemplateDraft("");
    setJobMessageTemplateName("");
    setIsAddingTemplate(false);
    setEditingTemplateId(null);
    setDraftServiceTypes([]);
    setDraftTriggerType("immediate");
    setDraftOffsetValue("0");
    setDraftOffsetUnit("days");
    setDraftDeliveryChannel("text");
    setTwilioAccountSid(
      isFreePlan
        ? ""
        : (typeof automation?.twilio?.account_sid === "string" ? automation.twilio.account_sid : ""),
    );
    setTwilioAuthToken(
      isFreePlan
        ? ""
        : (typeof automation?.twilio?.auth_token === "string" ? automation.twilio.auth_token : ""),
    );
    setTwilioFromNumber(
      isFreePlan
        ? ""
        : (typeof automation?.twilio?.from_number === "string" ? automation.twilio.from_number : ""),
    );
    setPaymentEmails(
      isFreePlan
        ? { estimate_approved: false, invoice_sent: false, payment_logged: false }
        : {
            ...DEFAULT_PAYMENT_EMAILS,
            ...(automation?.payment_emails ?? {}),
          },
    );
    setIsDirty(false);
  }, [settings, isFreePlan]);

  const isTwilioConnected = Boolean(twilioAccountSid.trim() && twilioAuthToken.trim() && twilioFromNumber.trim());
  const isJobAutomationDisabledByTwilio = !isFreePlan && !isTwilioConnected;

  useEffect(() => {
    if (isJobAutomationDisabledByTwilio && jobMessageAutomationEnabled) {
      setJobMessageAutomationEnabled(false);
      setIsDirty(true);
    }
  }, [isJobAutomationDisabledByTwilio, jobMessageAutomationEnabled]);

  const handleSave = async () => {
    const fallbackTemplate = jobMessageTemplates[0];
    const trimmedTwilioAccountSid = twilioAccountSid.trim();
    const trimmedTwilioAuthToken = twilioAuthToken.trim();
    const trimmedTwilioFromNumber = twilioFromNumber.trim();
    const hasTextDeliveryTemplate = jobMessageTemplates.some(
      (template) => template.is_finished && (template.delivery_channel === "text" || template.delivery_channel === "both"),
    );

    const paymentEmailsToSave = isFreePlan
      ? { estimate_approved: false, invoice_sent: false, payment_logged: false }
      : paymentEmails;

    if (
      !isFreePlan &&
      jobMessageAutomationEnabled &&
      hasTextDeliveryTemplate &&
      (!trimmedTwilioAccountSid || !trimmedTwilioAuthToken || !trimmedTwilioFromNumber)
    ) {
      toast.error("Connect your Twilio account SID, auth token, and sender number to send automated text messages.");
      return false;
    }

    try {
      await updateSettingsAsync({
        lead_message_automation: {
          enabled: isFreePlan ? false : leadMessageAutomationEnabled,
        },
        job_message_automation: {
          enabled: isFreePlan ? false : (isTwilioConnected ? jobMessageAutomationEnabled : false),
          message_template: isFreePlan ? "" : (jobMessageTemplates[0]?.content ?? ""),
          message_templates: isFreePlan ? [] : jobMessageTemplates.map((template) => ({
            id: template.id,
            name: template.name,
            content: template.content,
            is_finished: template.is_finished,
            delivery_channel: template.delivery_channel,
            job_service_types: template.job_service_types,
            trigger: template.trigger,
          })),
          job_service_types: isFreePlan ? [] : (fallbackTemplate?.job_service_types ?? []),
          trigger: {
            type: isFreePlan ? "immediate" : (fallbackTemplate?.trigger.type ?? "immediate"),
            offset_minutes: isFreePlan ? 0 : (fallbackTemplate ? offsetToMinutes(fallbackTemplate.trigger.offset_value, fallbackTemplate.trigger.offset_unit) : 0),
            offset_value: isFreePlan ? 0 : (fallbackTemplate?.trigger.offset_value ?? 0),
            offset_unit: isFreePlan ? "days" : (fallbackTemplate?.trigger.offset_unit ?? "days"),
          },
          endpoint: {
            enabled: isFreePlan ? false : true,
            url: isFreePlan ? "" : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-job-automation-message`,
            auth_header_name: "",
            auth_header_value: "",
          },
          retry: {
            max_attempts: 3,
            backoff_minutes: 5,
          },
          twilio: {
            account_sid: isFreePlan ? "" : trimmedTwilioAccountSid,
            auth_token: isFreePlan ? "" : trimmedTwilioAuthToken,
            from_number: isFreePlan ? "" : trimmedTwilioFromNumber,
          },
          payment_emails: paymentEmailsToSave,
        },
      });
      if (
        !isFreePlan &&
        leadMessageAutomationEnabled &&
        trimmedTwilioAccountSid &&
        trimmedTwilioAuthToken &&
        trimmedTwilioFromNumber &&
        currentAccount?.id
      ) {
        const { data, error } = await supabase.functions.invoke("configure-lead-sms-webhook", {
          body: { account_id: currentAccount.id },
        });

        if (error) {
          toast.error(`Auto Messaging settings saved, but Twilio inbound webhook setup failed: ${error.message || "Unknown error"}`);
        } else if (data?.success !== true) {
          toast.error(`Auto Messaging settings saved, but Twilio inbound webhook setup failed: ${typeof data?.error === "string" ? data.error : "Unknown error"}`);
        }
      }
      setIsDirty(false);
      toast.success("Auto Messaging settings saved");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
      return false;
    }
  };

  const toggleDraftServiceType = (serviceType: string) => {
    setDraftServiceTypes((current) => {
      if (current.includes(serviceType)) {
        return current.filter((value) => value !== serviceType);
      }
      return [...current, serviceType];
    });
    setIsDirty(true);
  };

  const addMessageTemplate = () => {
    const trimmedContent = jobMessageTemplateDraft.trim();
    const trimmedName = jobMessageTemplateName.trim();
    if (!trimmedContent) {
      toast.error("Add template content before saving");
      return;
    }
    const parsedDraftOffsetValue = Number.parseInt(draftOffsetValue, 10);
    setJobMessageTemplates((current) => {
      if (editingTemplateId) {
        return current.map((template) =>
          template.id === editingTemplateId
            ? {
              ...template,
              name: trimmedName || template.name,
              content: trimmedContent,
              delivery_channel: draftDeliveryChannel,
              job_service_types: draftServiceTypes,
              trigger: {
                type: draftTriggerType,
                offset_value: Number.isFinite(parsedDraftOffsetValue) && parsedDraftOffsetValue >= 0 ? parsedDraftOffsetValue : 0,
                offset_unit: draftOffsetUnit,
              },
            }
            : template,
        );
      }

      return [
        ...current,
        {
          id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmedName || `Template ${current.length + 1}`,
          content: trimmedContent,
          is_finished: true,
          delivery_channel: draftDeliveryChannel,
          job_service_types: draftServiceTypes,
          trigger: {
            type: draftTriggerType,
            offset_value: Number.isFinite(parsedDraftOffsetValue) && parsedDraftOffsetValue >= 0 ? parsedDraftOffsetValue : 0,
            offset_unit: draftOffsetUnit,
          },
        },
      ];
    });
    setJobMessageTemplateDraft("");
    setJobMessageTemplateName("");
    setEditingTemplateId(null);
    setDraftServiceTypes([]);
    setDraftTriggerType("immediate");
    setDraftOffsetValue("0");
    setDraftOffsetUnit("days");
    setDraftDeliveryChannel("text");
    setIsAddingTemplate(false);
    setIsDirty(true);
  };

  const removeMessageTemplate = (templateId: string) => {
    setJobMessageTemplates((current) => current.filter((template) => template.id !== templateId));
    if (editingTemplateId === templateId) {
      setEditingTemplateId(null);
      setJobMessageTemplateDraft("");
      setJobMessageTemplateName("");
      setDraftServiceTypes([]);
      setDraftTriggerType("immediate");
      setDraftOffsetValue("0");
      setDraftOffsetUnit("days");
      setDraftDeliveryChannel("text");
      setIsAddingTemplate(false);
    }
    setIsDirty(true);
  };

  const toggleTemplateEnabled = (templateId: string, enabled: boolean) => {
    setJobMessageTemplates((current) =>
      current.map((template) =>
        template.id === templateId
          ? {
            ...template,
            is_finished: enabled,
          }
          : template,
      ),
    );
    setIsDirty(true);
  };

  const editTemplate = (templateId: string) => {
    const template = jobMessageTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setEditingTemplateId(template.id);
    setJobMessageTemplateName(template.name);
    setJobMessageTemplateDraft(template.content);
    setDraftServiceTypes(template.job_service_types);
    setDraftTriggerType(template.trigger.type);
    setDraftOffsetValue(String(template.trigger.offset_value));
    setDraftOffsetUnit(template.trigger.offset_unit);
    setDraftDeliveryChannel(template.delivery_channel);
    setIsAddingTemplate(true);
  };

  const togglePaymentEmail = (key: PaymentEmailKey, checked: boolean) => {
    setPaymentEmails((current) => ({
      ...current,
      [key]: checked,
    }));
    setIsDirty(true);
  };

  const handleSendTestMessage = async () => {
    if (!currentAccount?.id) {
      toast.error("You need to be signed in to send a test message.");
      return;
    }

    if (isDirty) {
      toast.error("Save your auto messaging changes before sending a test message.");
      return;
    }

    const to = normalizePhone(testMessagePhoneNumber.trim());
    if (!to || to.length < 12) {
      toast.error("Enter a valid phone number to send the test message.");
      return;
    }

    setIsSendingTestMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-job-automation-test-message", {
        body: {
          account_id: currentAccount.id,
          to,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to send test message.");
        return;
      }

      if (data?.success !== true) {
        const stage = typeof data?.debug?.stage === "string" ? data.debug.stage : "";
        const detail =
          typeof data?.debug?.retell_status === "number"
            ? ` (stage: ${stage || "unknown"}, status: ${data.debug.retell_status})`
            : stage
              ? ` (stage: ${stage})`
              : "";
        toast.error(`${typeof data?.error === "string" ? data.error : "Failed to send test message."}${detail}`);
        return;
      }

      toast.success(`Test message sent to ${to}`);
      setTestMessagePhoneNumber("");
      setTestMessageModalOpen(false);
    } catch {
      toast.error("Could not reach the messaging service. Please try again.");
    } finally {
      setIsSendingTestMessage(false);
    }
  };

  const handleSendLeadTestMessage = async () => {
    if (!currentAccount?.id) {
      toast.error("You need to be signed in to send a test message.");
      return;
    }

    if (isDirty) {
      toast.error("Save your auto messaging changes before sending a test message.");
      return;
    }

    const to = normalizePhone(leadTestMessagePhoneNumber.trim());
    if (!to || to.length < 12) {
      toast.error("Enter a valid phone number to send the test message.");
      return;
    }

    setIsSendingLeadTestMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-lead-automation-test-message", {
        body: {
          account_id: currentAccount.id,
          to,
        },
      });

      if (error) {
        let detailedMessage = error.message || "Failed to send test message.";
        const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
        if (context?.json) {
          try {
            const payload = await context.json() as {
              error?: string;
              debug?: { stage?: string; retell_status?: number; provider_status?: number };
            };
            const stage = typeof payload?.debug?.stage === "string" ? payload.debug.stage : "";
            const status =
              typeof payload?.debug?.provider_status === "number"
                ? payload.debug.provider_status
                : typeof payload?.debug?.retell_status === "number"
                  ? payload.debug.retell_status
                  : null;
            const base = typeof payload?.error === "string" && payload.error ? payload.error : detailedMessage;
            const detail =
              stage && status !== null ? ` (stage: ${stage}, status: ${status})`
                : stage ? ` (stage: ${stage})`
                : "";
            detailedMessage = `${base}${detail}`;
          } catch {
            // Keep the original message when the edge error body is unavailable.
          }
        }
        toast.error(detailedMessage);
        return;
      }

      if (data?.success !== true) {
        const stage = typeof data?.debug?.stage === "string" ? data.debug.stage : "";
        const status =
          typeof data?.debug?.provider_status === "number"
            ? data.debug.provider_status
            : typeof data?.debug?.retell_status === "number"
              ? data.debug.retell_status
              : null;
        const detail =
          stage && status !== null ? ` (stage: ${stage}, status: ${status})`
            : stage ? ` (stage: ${stage})`
            : "";
        toast.error(`${typeof data?.error === "string" ? data.error : "Failed to send test message."}${detail}`);
        return;
      }

      toast.success(`Lead automation test sent to ${to}`);
      setLeadTestMessagePhoneNumber("");
      setLeadTestMessageModalOpen(false);
    } catch {
      toast.error("Could not reach the messaging service. Please try again.");
    } finally {
      setIsSendingLeadTestMessage(false);
    }
  };

  return (
    <PlanGate
      requiredPlan="basic"
      featureName="Auto Messaging"
      featureDescription="Automate job message workflows for follow-ups and outbound reminders."
      backTo="/settings"
    >
      <div className="min-h-screen bg-surface-sunken pb-24">
        <PageHeader
          title="Auto Messaging"
          subtitle="Automate job message workflows"
          showBack
          backTo="/settings"
        />

        <main className="max-w-[var(--content-max-width)] m-auto px-4 py-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img src="/twilio-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
                Connect your Twilio number
              </CardTitle>
              <CardDescription>
                Auto messaging sends from this connected Twilio number. LeadSig&apos;s number is only used for account notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="job-message-twilio-account-sid">Twilio Account SID</Label>
                  <Input
                    id="job-message-twilio-account-sid"
                    aria-label="Twilio account sid"
                    value={twilioAccountSid}
                    onChange={(event) => {
                      setTwilioAccountSid(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-message-twilio-auth-token">Twilio Auth Token</Label>
                  <Input
                    id="job-message-twilio-auth-token"
                    aria-label="Twilio auth token"
                    type="password"
                    value={twilioAuthToken}
                    onChange={(event) => {
                      setTwilioAuthToken(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Your Twilio auth token"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-message-twilio-from-number">Twilio sender number</Label>
                <Input
                  id="job-message-twilio-from-number"
                  aria-label="Connected twilio sender number"
                  type="tel"
                  value={twilioFromNumber}
                  onChange={(event) => {
                    setTwilioFromNumber(event.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="+15551234567"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setTestMessageModalOpen(true)}
                  disabled={isSendingTestMessage}
                >
                  <Mail className="h-4 w-4" />
                  Send test message
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Company Email Sender
              </CardTitle>
              <CardDescription>
                Connect the Google mailbox automated emails will send from for this company.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">Google Email</p>
                    {googleEmailConnection.isConnected ? (
                      <Badge variant="secondary">Connected</Badge>
                    ) : (
                      <Badge variant="outline">Not connected</Badge>
                    )}
                  </div>
                  {googleEmailConnection.isLoading ? (
                    <p className="text-sm text-muted-foreground">Checking connection...</p>
                  ) : googleEmailConnection.connectedEmail ? (
                    <p className="truncate text-sm text-muted-foreground">{googleEmailConnection.connectedEmail}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      One Google account can be connected as the company sender.
                    </p>
                  )}
                </div>
                {googleEmailConnection.isConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 sm:shrink-0"
                    onClick={() => googleEmailConnection.disconnect()}
                    disabled={googleEmailConnection.isDisconnecting}
                  >
                    {googleEmailConnection.isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Disconnect Google Email
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 sm:shrink-0"
                    onClick={() => googleEmailConnection.connect()}
                    disabled={googleEmailConnection.isLoading || googleEmailConnection.isConnecting}
                  >
                    {googleEmailConnection.isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Connect Google Email
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Signal Intent Filtering
                  </CardTitle>
                  <CardDescription>
                    Placeholder toggle for upcoming lead message automation workflows.
                  </CardDescription>
                </div>
                <div className="flex items-center sm:pt-1">
                  <Switch
                    id="enable-lead-message-automation"
                    aria-label="Enable lead message automation"
                    checked={leadMessageAutomationEnabled}
                    onCheckedChange={(checked) => {
                      setLeadMessageAutomationEnabled(checked);
                      setIsDirty(true);
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Uses your connected Twilio sender number for outbound website lead texts.
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setLeadTestMessageModalOpen(true)}
                  disabled={isSendingLeadTestMessage}
                >
                  <Mail className="h-4 w-4" />
                  Send lead test
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Job Message Automation
                  </CardTitle>
                  <CardDescription>
                    Configure automatic job messages that always send from your connected Twilio number.
                  </CardDescription>
                </div>
                <div className="flex items-center sm:pt-1">
                  <Switch
                    id="enable-job-message-automation"
                    aria-label="Enable job message automation"
                    checked={jobMessageAutomationEnabled}
                    disabled={isFreePlan || isJobAutomationDisabledByTwilio}
                    onCheckedChange={(checked) => {
                      setJobMessageAutomationEnabled(checked);
                      setIsDirty(true);
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {isJobAutomationDisabledByTwilio ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Connect a Twilio account SID, auth token, and sender number above to enable Job Message Automation.
                </div>
              ) : null}
              {jobMessageAutomationEnabled ? (
                <>

              <div className="space-y-3">
                <Label>Templates</Label>
                <div className="rounded-lg border bg-background p-3">
                  {jobMessageTemplates.length > 0 ? (
                    <div className="divide-y">
                      {jobMessageTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex cursor-pointer items-start justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0 hover:bg-accent/30"
                          onClick={() => editTemplate(template.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              editTemplate(template.id);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2 pr-2">
                            <Pencil className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {template.name}
                                  {!template.is_finished ? <span className="ml-2 text-xs text-muted-foreground">(Disabled)</span> : null}
                                </p>
                                <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                                  {template.delivery_channel}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{template.content}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 pt-0.5">
                            <Switch
                              checked={template.is_finished}
                              onClick={(event) => event.stopPropagation()}
                              onCheckedChange={(checked) => toggleTemplateEnabled(template.id, checked)}
                              aria-label={`Enable ${template.name}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeMessageTemplate(template.id);
                              }}
                              aria-label={`Delete ${template.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No templates created.</p>
                  )}
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setIsAddingTemplate((current) => {
                      const next = !current;
                      if (!next) {
                        setEditingTemplateId(null);
                        setJobMessageTemplateDraft("");
                        setJobMessageTemplateName("");
                        setDraftServiceTypes([]);
                        setDraftTriggerType("immediate");
                        setDraftOffsetValue("0");
                        setDraftOffsetUnit("days");
                        setDraftDeliveryChannel("text");
                      }
                      return next;
                    });
                  }}
                >
                  {isAddingTemplate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isAddingTemplate ? "Cancel template" : "Add template"}
                </Button>
              </div>

              {isAddingTemplate ? (
                <div className="space-y-5 rounded-lg border bg-background p-4">
                  <div className="space-y-3">
                    <Label htmlFor="job-message-template-name">Message template</Label>
                    <div className="space-y-2">
                      <Input
                        id="job-message-template-name"
                        value={jobMessageTemplateName}
                        onChange={(event) => {
                          setJobMessageTemplateName(event.target.value);
                          setIsDirty(true);
                        }}
                        placeholder="Template name (optional)"
                      />
                      <Textarea
                        id="job-message-template"
                        value={jobMessageTemplateDraft}
                        onChange={(event) => {
                          setJobMessageTemplateDraft(event.target.value);
                          setIsDirty(true);
                        }}
                        placeholder="Reminder: {{job_name}} is scheduled for {{scheduled_date}}"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground">Variables:</p>
                        <div className="flex flex-wrap gap-2">
                          {TEMPLATE_VARIABLES.map((variableName) => (
                            <Badge
                              key={variableName}
                              variant="outline"
                              className="font-mono text-xs font-normal text-muted-foreground border-muted-foreground/30"
                            >
                              {variableName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="job-message-delivery-channel">Send as</Label>
                    <select
                      id="job-message-delivery-channel"
                      value={draftDeliveryChannel}
                      onChange={(event) => {
                        setDraftDeliveryChannel(event.target.value as DeliveryChannel);
                        setIsDirty(true);
                      }}
                      className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="both">Both</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <Label>Jobs this message applies to</Label>
                    <div className="space-y-3">
                      <Popover open={serviceTypePopoverOpen} onOpenChange={setServiceTypePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={serviceTypePopoverOpen}
                            className="w-full justify-between font-normal"
                          >
                            Select service types
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search service types..." />
                            <CommandList>
                              <CommandEmpty>No service types found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="All service types"
                                  onSelect={() => {
                                    setDraftServiceTypes([]);
                                    setIsDirty(true);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${draftServiceTypes.length === 0 ? "opacity-100" : "opacity-0"}`} />
                                  All service types
                                </CommandItem>
                                {SERVICE_TYPES.map((serviceType) => {
                                  const isSelected = draftServiceTypes.includes(serviceType);
                                  return (
                                    <CommandItem
                                      key={serviceType}
                                      value={serviceType}
                                      onSelect={() => toggleDraftServiceType(serviceType)}
                                    >
                                      <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                      {serviceType}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <div className="flex flex-wrap gap-2">
                        {draftServiceTypes.length > 0 ? (
                          draftServiceTypes.map((serviceType) => (
                            <Badge key={serviceType} variant="secondary" className="gap-1 pr-1">
                              {serviceType}
                              <button
                                type="button"
                                onClick={() => toggleDraftServiceType(serviceType)}
                                className="rounded-sm p-0.5 hover:bg-black/10 dark:hover:bg-white/20"
                                aria-label={`Remove ${serviceType}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary">All service types</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="job-message-trigger-timing">Trigger timing</Label>
                      <select
                        id="job-message-trigger-timing"
                        value={draftTriggerType}
                        onChange={(event) => {
                          setDraftTriggerType(
                            event.target.value as "immediate" | "before_schedule_start" | "after_schedule_start" | "after_job_completion",
                          );
                          setIsDirty(true);
                        }}
                        className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
                      >
                        <option value="immediate">Immediate</option>
                        <option value="before_schedule_start">Before schedule start</option>
                        <option value="after_schedule_start">After schedule start</option>
                        <option value="after_job_completion">After job completion</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job-message-offset-value">Offset</Label>
                      <div className="flex gap-2">
                        <Input
                          id="job-message-offset-value"
                          type="number"
                          min={0}
                          value={draftOffsetValue}
                          onChange={(event) => {
                            setDraftOffsetValue(event.target.value);
                            setIsDirty(true);
                          }}
                          disabled={draftTriggerType === "immediate"}
                        />
                        <select
                          id="job-message-offset-unit"
                          value={draftOffsetUnit}
                          onChange={(event) => {
                            setDraftOffsetUnit(event.target.value as OffsetUnit);
                            setIsDirty(true);
                          }}
                          className="h-10 w-32 rounded-full border border-input bg-background px-3 text-sm"
                          disabled={draftTriggerType === "immediate"}
                        >
                          {OFFSET_UNITS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" className="gap-2" onClick={addMessageTemplate}>
                      <Check className="h-4 w-4" />
                      {editingTemplateId ? "Save template" : "Confirm template"}
                    </Button>
                  </div>
                </div>
              ) : null}

                </>
              ) : null}

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Payment Emails
              </CardTitle>
              <CardDescription>
                Send customer emails when payment-related milestones happen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 rounded-lg border bg-background p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Estimate approved</p>
                      <p className="text-xs text-muted-foreground">Email customer when an estimate is approved.</p>
                    </div>
                    <Switch
                      aria-label="Send payment email when estimate is approved"
                      checked={paymentEmails.estimate_approved}
                      onCheckedChange={(checked) => togglePaymentEmail("estimate_approved", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Invoice sent</p>
                      <p className="text-xs text-muted-foreground">Email customer when an invoice is sent.</p>
                    </div>
                    <Switch
                      aria-label="Send payment email when invoice is sent"
                      checked={paymentEmails.invoice_sent}
                      onCheckedChange={(checked) => togglePaymentEmail("invoice_sent", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Payment logged</p>
                      <p className="text-xs text-muted-foreground">Email customer when a payment is logged.</p>
                    </div>
                    <Switch
                      aria-label="Send payment email when payment is logged"
                      checked={paymentEmails.payment_logged}
                      onCheckedChange={(checked) => togglePaymentEmail("payment_logged", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </main>

        <div className="fixed bottom-24 right-4 z-40 sm:bottom-6 sm:right-6">
          <Button
            onClick={handleSave}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            disabled={isSaving}
            aria-label={isSaving ? "Saving changes" : "Save changes"}
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          </Button>
        </div>

        <MobileNav />
        <UnsavedChangesDialog blocker={blocker} onSaveAndLeave={handleSave} />
        <Dialog open={testMessageModalOpen} onOpenChange={setTestMessageModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send test message</DialogTitle>
              <DialogDescription>
                Enter the phone number that should receive a test text from your connected Twilio number.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="job-message-test-phone">Destination phone number</Label>
              <Input
                id="job-message-test-phone"
                type="tel"
                value={testMessagePhoneNumber}
                onChange={(event) => setTestMessagePhoneNumber(event.target.value)}
                placeholder="+15551234567"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTestMessageModalOpen(false)} disabled={isSendingTestMessage}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSendTestMessage} disabled={isSendingTestMessage}>
                {isSendingTestMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={leadTestMessageModalOpen} onOpenChange={setLeadTestMessageModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send lead automation test</DialogTitle>
              <DialogDescription>
                Enter the phone number that should receive a Retell-powered lead automation test text.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="lead-message-test-phone">Lead test destination phone number</Label>
              <Input
                id="lead-message-test-phone"
                type="tel"
                value={leadTestMessagePhoneNumber}
                onChange={(event) => setLeadTestMessagePhoneNumber(event.target.value)}
                placeholder="+15551234567"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLeadTestMessageModalOpen(false)} disabled={isSendingLeadTestMessage}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSendLeadTestMessage} disabled={isSendingLeadTestMessage}>
                {isSendingLeadTestMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send lead test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PlanGate>
  );
}
