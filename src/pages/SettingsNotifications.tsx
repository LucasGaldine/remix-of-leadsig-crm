import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  DollarSign,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Inbox,
  Send,
  History,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSmsLogs } from "@/hooks/useSmsLogs";
import { formatDistanceToNow } from "date-fns";

type Channel = "push" | "email" | "sms";
type AlertKey = "new_leads" | "lead_updates" | "payments" | "schedule_changes" | "tasks";

type NotificationPreferences = {
  channels: Record<Channel, boolean>;
  alerts: Record<AlertKey, boolean>;
  quiet_hours: { enabled: boolean; start: string; end: string };
  digest: { frequency: "off" | "daily" | "weekly" };
};

const channelMeta: Record<Channel, { label: string; icon: React.ReactNode; helper: string; badge?: string }> = {
  push: { label: "Push", icon: <Smartphone className="h-4 w-4" />, helper: "App & desktop" },
  email: { label: "Email", icon: <Mail className="h-4 w-4" />, helper: "Detailed updates" },
  sms: { label: "SMS", icon: <MessageSquare className="h-4 w-4" />, helper: "Via Twilio", badge: "Twilio" },
};

const alertMeta: Record<AlertKey, { label: string; description: string; icon: React.ReactNode }> = {
  new_leads: {
    label: "New leads",
    description: "Get alerted when a new lead arrives so you can respond quickly.",
    icon: <Bell className="h-4 w-4" />,
  },
  lead_updates: {
    label: "Lead status changes",
    description: "When a lead moves between stages or is assigned.",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  payments: {
    label: "Payments & invoices",
    description: "New payments, failed charges, or overdue invoices.",
    icon: <DollarSign className="h-4 w-4" />,
  },
  schedule_changes: {
    label: "Schedule changes",
    description: "Crew assignments, reschedules, and cancellations.",
    icon: <CalendarClock className="h-4 w-4" />,
  },
  tasks: {
    label: "Tasks & reminders",
    description: "Daily to-dos and follow-up reminders.",
    icon: <Inbox className="h-4 w-4" />,
  },
};

const eventTypeLabels: Record<string, string> = {
  new_leads: "New lead",
  lead_updates: "Lead update",
  payments: "Payment",
  schedule_changes: "Schedule change",
  tasks: "Task",
};

export default function SettingsNotifications() {
  const { profile, user, currentAccount, refreshProfile } = useAuth();
  const { logs: smsLogs, isLoading: smsLogsLoading, refetch: refetchSmsLogs } = useSmsLogs(5);

  const hasEmail = Boolean(profile?.email || user?.email);
  const hasPhone = Boolean(profile?.phone);

  const defaultPrefs: NotificationPreferences = useMemo(
    () => ({
      channels: { push: false, email: false, sms: false },
      alerts: {
        new_leads: true,
        lead_updates: true,
        payments: true,
        schedule_changes: true,
        tasks: false,
      },
      quiet_hours: { enabled: false, start: "21:00", end: "07:00" },
      digest: { frequency: "daily" },
    }),
    []
  );

  const [channels, setChannels] = useState<Record<Channel, boolean>>(defaultPrefs.channels);
  const [alerts, setAlerts] = useState<Record<AlertKey, boolean>>(defaultPrefs.alerts);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(defaultPrefs.quiet_hours.enabled);
  const [quietStart, setQuietStart] = useState(defaultPrefs.quiet_hours.start);
  const [quietEnd, setQuietEnd] = useState(defaultPrefs.quiet_hours.end);
  const [digestFrequency, setDigestFrequency] = useState<"off" | "daily" | "weekly">(defaultPrefs.digest.frequency);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);

  // Load saved preferences from profile
  useEffect(() => {
    const prefs = profile?.notification_preferences as Partial<NotificationPreferences> | null | undefined;
    if (!prefs) return;

    setChannels({ ...defaultPrefs.channels, ...(prefs.channels || {}) });
    setAlerts({ ...defaultPrefs.alerts, ...(prefs.alerts || {}) });
    setQuietHoursEnabled(prefs.quiet_hours?.enabled ?? defaultPrefs.quiet_hours.enabled);
    setQuietStart(prefs.quiet_hours?.start ?? defaultPrefs.quiet_hours.start);
    setQuietEnd(prefs.quiet_hours?.end ?? defaultPrefs.quiet_hours.end);
    setDigestFrequency(prefs.digest?.frequency ?? defaultPrefs.digest.frequency);
  }, [profile?.notification_preferences, defaultPrefs]);

  const channelAvailability: Record<Channel, { available: boolean; reason?: string }> = {
    push: { available: false, reason: "Coming soon" },
    email: { available: hasEmail, reason: hasEmail ? undefined : "Add an email to your profile" },
    sms: { available: hasPhone, reason: hasPhone ? undefined : "Add a phone number to your profile" },
  };

  const toggleChannel = (key: Channel, value: boolean) => {
    if (!channelAvailability[key].available) return;
    setChannels((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const toggleAlert = (key: AlertKey, value: boolean) => {
    setAlerts((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleTest = async () => {
    if (!currentAccount || !user) {
      toast.error("You need to be signed in to send a test.");
      return;
    }

    if (!channels.sms) {
      toast.info("Enable the SMS channel first, then save your preferences.");
      return;
    }

    if (!profile?.phone) {
      toast.error("Add a phone number to your profile to test SMS.");
      return;
    }

    setIsSendingTest(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "new_leads",
          account_id: currentAccount.id,
          data: {
            name: "Test Lead",
            phone: "(555) 000-0000",
            service_type: "Test notification",
            source: "manual",
          },
        }),
      });

      const result = await response.json();

      if (response.ok && result.sent > 0) {
        toast.success("Test SMS sent to " + profile.phone);
        refetchSmsLogs();
      } else if (response.ok && result.sent === 0) {
        toast.info(result.reason || "No SMS sent. Check that SMS is enabled and your preferences are saved.");
      } else {
        toast.error(result.error || "Failed to send test SMS");
      }
    } catch {
      toast.error("Could not reach the SMS service. Please try again.");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("You need to be signed in to save preferences.");
      return;
    }

    const payload: NotificationPreferences = {
      channels,
      alerts,
      quiet_hours: { enabled: quietHoursEnabled, start: quietStart, end: quietEnd },
      digest: { frequency: digestFrequency },
    };

    setIsSaving(true);
    // Try update first
    let { data, error } = await supabase
      .from("profiles")
      .update({ notification_preferences: payload })
      .eq("user_id", user.id)
      .select("notification_preferences")
      .maybeSingle();

    // If no row was updated, try insert (profile may not exist yet)
    if (!error && !data) {
      const insertResult = await supabase
        .from("profiles")
        .insert({ user_id: user.id, notification_preferences: payload })
        .select("notification_preferences")
        .maybeSingle();

      data = insertResult.data;
      error = insertResult.error;
    }

    if (error || !data) {
      console.error("Failed to save notification preferences", error);
      const msg =
        error?.message ||
        "Could not save preferences (profile missing or no permission). Please contact support.";
      toast.error(msg);
      setIsSaving(false);
      return;
    }

    // Keep UI in sync immediately using the saved response
    const saved = (data?.notification_preferences || payload) as NotificationPreferences;
    setChannels(saved.channels);
    setAlerts(saved.alerts);
    setQuietHoursEnabled(saved.quiet_hours.enabled);
    setQuietStart(saved.quiet_hours.start);
    setQuietEnd(saved.quiet_hours.end);
    setDigestFrequency(saved.digest.frequency);

    setIsDirty(false);
    toast.success("Notification preferences saved");
    await refreshProfile();

    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Notification Settings" showBack backTo="/settings" showNotifications={false} />

      <main className="px-4 py-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Channels
            </CardTitle>
            <CardDescription>Choose where we should reach you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {(Object.keys(channelMeta) as Channel[]).map((channel) => {
              const { available, reason } = channelAvailability[channel];
              const isComingSoon = channel === "push";
              return (
                <div
                  key={channel}
                  className={cn(
                    "relative flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                    !available && "opacity-60",
                    channels[channel] && available ? "bg-[hsl(var(--status-confirmed-bg))]" : "bg-card"
                  )}
                >
                  {isComingSoon && (
                    <span className="absolute -top-2.5 left-3 bg-slate-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide">
                      COMING SOON
                    </span>
                  )}
                  {channelMeta[channel].badge && available && (
                    <span className="absolute -top-2.5 right-3 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide">
                      {channelMeta[channel].badge}
                    </span>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "p-2 rounded-lg",
                        available ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {channelMeta[channel].icon}
                      </span>
                      <span className={cn(
                        "font-medium",
                        available ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {channelMeta[channel].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-10">
                      {!available && reason ? reason : channelMeta[channel].helper}
                    </p>
                  </div>
                  <Switch
                    checked={available ? channels[channel] : false}
                    onCheckedChange={(v) => toggleChannel(channel, v)}
                    disabled={!available}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alerts
            </CardTitle>
            <CardDescription>Pick the events that should trigger notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(alertMeta) as AlertKey[]).map((key) => (
              <div
                key={key}
                className="flex items-start justify-between rounded-lg border px-4 py-3 gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary text-secondary-foreground mt-0.5">
                    {alertMeta[key].icon}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{alertMeta[key].label}</p>
                    <p className="text-sm text-muted-foreground">{alertMeta[key].description}</p>
                  </div>
                </div>
                <Switch checked={alerts[key]} onCheckedChange={(v) => toggleAlert(key, v)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Quiet Hours
            </CardTitle>
            <CardDescription>Silence alerts outside your working hours. We’ll queue them for later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Enable quiet hours</p>
                <p className="text-sm text-muted-foreground">
                  Pause push & SMS. Urgent payment failures still arrive by email.
                </p>
              </div>
              <Switch checked={quietHoursEnabled} onCheckedChange={(v) => { setQuietHoursEnabled(v); setIsDirty(true); }} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietStart}
                  onChange={(e) => { setQuietStart(e.target.value); setIsDirty(true); }}
                  disabled={!quietHoursEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietEnd}
                  onChange={(e) => { setQuietEnd(e.target.value); setIsDirty(true); }}
                  disabled={!quietHoursEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Digest & escalation
            </CardTitle>
            <CardDescription>Get a summary instead of many pings, and flag overdue items.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email digest</Label>
                <Select value={digestFrequency} onValueChange={(v: "off" | "daily" | "weekly") => { setDigestFrequency(v); setIsDirty(true); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="daily">Daily at 8:00 AM</SelectItem>
                    <SelectItem value="weekly">Weekly on Monday</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Includes new leads, payments, and schedule changes.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Overdue invoice escalation</Label>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Alert me when invoices are overdue</p>
                    <p className="text-xs text-muted-foreground">Sends push + email when an invoice is 3+ days late.</p>
                  </div>
                  <Switch checked={alerts.payments} onCheckedChange={(v) => toggleAlert("payments", v)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Test SMS
            </CardTitle>
            <CardDescription>Send yourself a test SMS to confirm Twilio is configured correctly.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Send a test SMS</p>
              <p className="text-sm text-muted-foreground">
                {channels.sms
                  ? `Sends to ${profile?.phone || "your phone number"}`
                  : "Enable SMS channel first"}
              </p>
            </div>
            <Button
              onClick={handleTest}
              disabled={isSendingTest || !channels.sms || !hasPhone}
              className="w-full sm:w-auto gap-2"
            >
              {isSendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              {isSendingTest ? "Sending..." : "Send test SMS"}
            </Button>
          </CardContent>
        </Card>

        {channels.sms && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent SMS Activity
              </CardTitle>
              <CardDescription>Last {smsLogs.length > 0 ? smsLogs.length : "few"} SMS notifications sent from your account.</CardDescription>
            </CardHeader>
            <CardContent>
              {smsLogsLoading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : smsLogs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No SMS notifications sent yet.</p>
                  <p className="text-xs mt-1">Messages will appear here once events trigger SMS alerts.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {smsLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between rounded-lg border px-4 py-3 gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          "p-1.5 rounded-full mt-0.5 shrink-0",
                          log.status === "sent" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                        )}>
                          {log.status === "sent" ? (
                            <CheckCircle className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">
                              {eventTypeLabels[log.event_type] || log.event_type}
                            </p>
                            <Badge variant={log.status === "sent" ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                              {log.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {log.message_body}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <StickyActionBar onSave={handleSave} isSaving={isSaving} label="Save preferences" />
      </main>

      <MobileNav />
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  );
}
