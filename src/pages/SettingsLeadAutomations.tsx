import { useEffect, useMemo, useState } from "react";
import { Bot, Copy, PhoneCall, Settings2, Webhook } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function WebhookRow({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy: () => Promise<void>;
}) {
  return (
    <div>
      <p className="text-xs font-medium mb-1">{title}</p>
      <div className="flex items-center gap-2 p-2 bg-muted rounded border">
        <code className="flex-1 text-xs break-all">{value}</code>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function SettingsLeadAutomations() {
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const { settings, updateSettingsAsync, isSaving } = useAccountSettings();

  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);

  const [autoQualifyIntegrationLeads, setAutoQualifyIntegrationLeads] = useState(false);
  const [autoQualifyEndpointUrl, setAutoQualifyEndpointUrl] = useState("");
  const [autoQualifyAuthHeaderName, setAutoQualifyAuthHeaderName] = useState("");
  const [autoQualifyAuthHeaderValue, setAutoQualifyAuthHeaderValue] = useState("");
  const [jobMessageAutomationEnabled, setJobMessageAutomationEnabled] = useState(false);
  const [jobMessageTemplate, setJobMessageTemplate] = useState("");
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [triggerType, setTriggerType] = useState<"immediate" | "before_schedule_start" | "after_schedule_start">("immediate");
  const [offsetMinutes, setOffsetMinutes] = useState("0");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [authHeaderName, setAuthHeaderName] = useState("");
  const [authHeaderValue, setAuthHeaderValue] = useState("");
  const [maxRetryAttempts, setMaxRetryAttempts] = useState("3");
  const [retryBackoffMinutes, setRetryBackoffMinutes] = useState("5");

  useEffect(() => {
    const automation = settings?.job_message_automation ?? null;
    const autoQualifyWebhook = settings?.auto_qualify_webhook ?? null;

    setAutoQualifyIntegrationLeads(settings?.auto_qualify_integration_leads === true);
    setAutoQualifyEndpointUrl(typeof autoQualifyWebhook?.endpoint_url === "string" ? autoQualifyWebhook.endpoint_url : "");
    setAutoQualifyAuthHeaderName(typeof autoQualifyWebhook?.auth_header_name === "string" ? autoQualifyWebhook.auth_header_name : "");
    setAutoQualifyAuthHeaderValue(typeof autoQualifyWebhook?.auth_header_value === "string" ? autoQualifyWebhook.auth_header_value : "");
    setJobMessageAutomationEnabled(automation?.enabled === true);
    setJobMessageTemplate(typeof automation?.message_template === "string" ? automation.message_template : "");
    setSelectedServiceTypes(Array.isArray(automation?.job_service_types) ? automation.job_service_types.filter((value): value is string => typeof value === "string") : []);
    setTriggerType(
      automation?.trigger?.type === "before_schedule_start" || automation?.trigger?.type === "after_schedule_start"
        ? automation.trigger.type
        : "immediate",
    );
    setOffsetMinutes(String(typeof automation?.trigger?.offset_minutes === "number" ? automation.trigger.offset_minutes : 0));
    setEndpointUrl(typeof automation?.endpoint?.url === "string" ? automation.endpoint.url : "");
    setAuthHeaderName(typeof automation?.endpoint?.auth_header_name === "string" ? automation.endpoint.auth_header_name : "");
    setAuthHeaderValue(typeof automation?.endpoint?.auth_header_value === "string" ? automation.endpoint.auth_header_value : "");
    setMaxRetryAttempts(String(typeof automation?.retry?.max_attempts === "number" ? automation.retry.max_attempts : 3));
    setRetryBackoffMinutes(String(typeof automation?.retry?.backoff_minutes === "number" ? automation.retry.backoff_minutes : 5));
    setIsDirty(false);
  }, [settings?.auto_qualify_integration_leads, settings?.job_message_automation]);

  const functionBaseUrl = useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1`;
  }, []);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const handleSave = async () => {
    if (!currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    const parsedOffsetMinutes = Number.parseInt(offsetMinutes, 10);
    const parsedMaxRetryAttempts = Number.parseInt(maxRetryAttempts, 10);
    const parsedRetryBackoffMinutes = Number.parseInt(retryBackoffMinutes, 10);

    try {
      await updateSettingsAsync({
        auto_qualify_integration_leads: autoQualifyIntegrationLeads,
        auto_qualify_webhook: {
          endpoint_url: autoQualifyEndpointUrl.trim(),
          auth_header_name: autoQualifyAuthHeaderName.trim(),
          auth_header_value: autoQualifyAuthHeaderValue,
        },
        job_message_automation: {
          enabled: jobMessageAutomationEnabled,
          message_template: jobMessageTemplate.trim(),
          job_service_types: selectedServiceTypes,
          trigger: {
            type: triggerType,
            offset_minutes: Number.isFinite(parsedOffsetMinutes) && parsedOffsetMinutes >= 0 ? parsedOffsetMinutes : 0,
          },
          endpoint: {
            url: endpointUrl.trim(),
            auth_header_name: authHeaderName.trim(),
            auth_header_value: authHeaderValue,
          },
          retry: {
            max_attempts: Number.isFinite(parsedMaxRetryAttempts) && parsedMaxRetryAttempts > 0 ? parsedMaxRetryAttempts : 3,
            backoff_minutes: Number.isFinite(parsedRetryBackoffMinutes) && parsedRetryBackoffMinutes >= 0 ? parsedRetryBackoffMinutes : 5,
          },
        },
      });
      setIsDirty(false);
      toast.success("Lead automation settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  const toggleServiceType = (serviceType: string) => {
    setSelectedServiceTypes((current) => {
      if (current.includes(serviceType)) {
        return current.filter((value) => value !== serviceType);
      }
      return [...current, serviceType];
    });
    setIsDirty(true);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Lead Automations"
        subtitle="Webhook hooks and automation behavior"
        showBack
        backTo="/settings"
      />

      <main className="px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Integration Lead Rules
            </CardTitle>
            <CardDescription>
              Control what happens to leads created by integrations and automation tools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
              <div className="space-y-1">
                <Label htmlFor="auto-qualify-integration-leads">Auto-qualify integration leads</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, new leads from integrations are inserted as approved and qualified.
                </p>
              </div>
              <Switch
                id="auto-qualify-integration-leads"
                checked={autoQualifyIntegrationLeads}
                onCheckedChange={(checked) => {
                  setAutoQualifyIntegrationLeads(checked);
                  setIsDirty(true);
                }}
              />
            </div>
            <div className="mt-4 space-y-4 rounded-lg border bg-background p-4">
              <div className="space-y-2">
                <Label htmlFor="auto-qualify-endpoint-url">Auto-qualify endpoint URL</Label>
                <Input
                  id="auto-qualify-endpoint-url"
                  type="url"
                  value={autoQualifyEndpointUrl}
                  onChange={(event) => {
                    setAutoQualifyEndpointUrl(event.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="https://example.com/hooks/auto-qualify"
                />
                <p className="text-sm text-muted-foreground">
                  When configured, each integration lead is sent to this endpoint and the response determines qualified or not qualified.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="auto-qualify-auth-header-name">Auto-qualify auth header name</Label>
                  <Input
                    id="auto-qualify-auth-header-name"
                    value={autoQualifyAuthHeaderName}
                    onChange={(event) => {
                      setAutoQualifyAuthHeaderName(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Authorization"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto-qualify-auth-header-value">Auto-qualify auth header value</Label>
                  <Input
                    id="auto-qualify-auth-header-value"
                    value={autoQualifyAuthHeaderValue}
                    onChange={(event) => {
                      setAutoQualifyAuthHeaderValue(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Bearer <token>"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Message Automation</CardTitle>
            <CardDescription>
              Configure an automatic job message event and send a full payload to your endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
              <div className="space-y-1">
                <Label htmlFor="enable-job-message-automation">Enable job message automation</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, matching jobs trigger message events delivered to your configured endpoint.
                </p>
              </div>
              <Switch
                id="enable-job-message-automation"
                checked={jobMessageAutomationEnabled}
                onCheckedChange={(checked) => {
                  setJobMessageAutomationEnabled(checked);
                  setIsDirty(true);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-message-template">Message template</Label>
              <Textarea
                id="job-message-template"
                value={jobMessageTemplate}
                onChange={(event) => {
                  setJobMessageTemplate(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="Reminder: {{job_name}} is scheduled for {{scheduled_date}}"
              />
            </div>

            <div className="space-y-3">
              <Label>Jobs this message applies to</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICE_TYPES.map((serviceType) => (
                  <div key={serviceType} className="flex items-center gap-2 rounded border p-2">
                    <Checkbox
                      id={`job-service-type-${serviceType}`}
                      checked={selectedServiceTypes.includes(serviceType)}
                      onCheckedChange={() => toggleServiceType(serviceType)}
                    />
                    <Label htmlFor={`job-service-type-${serviceType}`}>{serviceType}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-message-trigger-timing">Trigger timing</Label>
                <select
                  id="job-message-trigger-timing"
                  value={triggerType}
                  onChange={(event) => {
                    setTriggerType(event.target.value as "immediate" | "before_schedule_start" | "after_schedule_start");
                    setIsDirty(true);
                  }}
                  className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
                >
                  <option value="immediate">Immediate</option>
                  <option value="before_schedule_start">Before schedule start</option>
                  <option value="after_schedule_start">After schedule start</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-message-offset-minutes">Offset minutes</Label>
                <Input
                  id="job-message-offset-minutes"
                  type="number"
                  min={0}
                  value={offsetMinutes}
                  onChange={(event) => {
                    setOffsetMinutes(event.target.value);
                    setIsDirty(true);
                  }}
                  disabled={triggerType === "immediate"}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="job-message-endpoint-url">Job message endpoint URL</Label>
              <Input
                id="job-message-endpoint-url"
                type="url"
                value={endpointUrl}
                onChange={(event) => {
                  setEndpointUrl(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="https://example.com/hooks/job-message"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-message-auth-header-name">Job message auth header name</Label>
                <Input
                  id="job-message-auth-header-name"
                  value={authHeaderName}
                  onChange={(event) => {
                    setAuthHeaderName(event.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Authorization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-message-auth-header-value">Job message auth header value</Label>
                <Input
                  id="job-message-auth-header-value"
                  value={authHeaderValue}
                  onChange={(event) => {
                    setAuthHeaderValue(event.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Bearer <token>"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-message-max-retry-attempts">Max retry attempts</Label>
                <Input
                  id="job-message-max-retry-attempts"
                  type="number"
                  min={1}
                  value={maxRetryAttempts}
                  onChange={(event) => {
                    setMaxRetryAttempts(event.target.value);
                    setIsDirty(true);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-message-retry-backoff-minutes">Retry backoff minutes</Label>
                <Input
                  id="job-message-retry-backoff-minutes"
                  type="number"
                  min={0}
                  value={retryBackoffMinutes}
                  onChange={(event) => {
                    setRetryBackoffMinutes(event.target.value);
                    setIsDirty(true);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Messaging Bot Webhook
            </CardTitle>
            <CardDescription>
              Let SMS/chat bots log inbound or outbound messages directly to a client timeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <WebhookRow
              title="Endpoint"
              value={`POST ${functionBaseUrl}/leads-log-message`}
              onCopy={() => handleCopy(`${functionBaseUrl}/leads-log-message`, "Message webhook URL")}
            />
            <WebhookRow
              title="Header"
              value="x-leadsig-api-key: <your-api-key>"
              onCopy={() => handleCopy("x-leadsig-api-key", "Header name")}
            />
            <pre className="text-xs overflow-x-auto p-3 rounded border bg-muted/50">{`{
  "lead_id": "<optional-lead-id>",
  "client": { "email": "client@example.com", "phone": "555-123-4567" },
  "direction": "inbound",
  "summary": "Bot follow-up",
  "message": "Thanks for reaching out. We'll call you shortly.",
  "metadata": { "provider": "twilio" }
}`}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Call Intake Webhook
            </CardTitle>
            <CardDescription>
              Let call center and intake agents log calls for a client without opening LeadSig.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <WebhookRow
              title="Endpoint"
              value={`POST ${functionBaseUrl}/leads-log-call`}
              onCopy={() => handleCopy(`${functionBaseUrl}/leads-log-call`, "Call webhook URL")}
            />
            <WebhookRow
              title="Header"
              value="x-leadsig-api-key: <your-api-key>"
              onCopy={() => handleCopy("x-leadsig-api-key", "Header name")}
            />
            <pre className="text-xs overflow-x-auto p-3 rounded border bg-muted/50">{`{
  "lead_id": "<optional-lead-id>",
  "client": { "external_source_id": "abc123", "phone": "555-123-4567" },
  "direction": "inbound",
  "summary": "Initial intake call",
  "notes": "Client wants paver patio quote.",
  "duration_seconds": 420,
  "call_outcome": "qualified_for_site_visit",
  "metadata": { "agent": "Sofia" }
}`}</pre>
          </CardContent>
        </Card>

        <div className="pt-1">
          <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/settings/api-keys")}>
            <Webhook className="h-4 w-4" />
            Manage API Keys
          </Button>
        </div>

        <StickyActionBar onSave={handleSave} isSaving={isSaving} />
      </main>

      <MobileNav />
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  );
}
