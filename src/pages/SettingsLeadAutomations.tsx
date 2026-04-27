import { useMemo } from "react";
import { Bot, Copy, PhoneCall, Webhook } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Webhooks"
        subtitle="Webhook hooks and API automations"
        showBack
        backTo="/settings"
      />

      <main className="max-w-[var(--content-max-width)] m-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Messaging Bot Webhook
            </CardTitle>
            <CardDescription>
              Let SMS/chat bots log inbound or outbound messages directly to a contact timeline.
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
  "client": { "email": "contact@example.com", "phone": "555-123-4567" },
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
              Let call center and intake agents log calls for a contact without opening LeadSig.
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
  "notes": "Contact wants paver patio quote.",
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
      </main>

      <MobileNav />
    </div>
  );
}
