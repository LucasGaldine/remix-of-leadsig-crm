import { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  MapPin,
  Play,
  Square,
  Loader2,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeofence, geocodeAddress } from "@/hooks/useGeofence";
import { toast } from "sonner";
import { format } from "date-fns";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  is_auto: boolean;
  notes: string | null;
}

interface JobTimeTrackerProps {
  jobId: string;
  jobAddress: string | null;
  accountId?: string;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function JobTimeTracker({ jobId, jobAddress, accountId }: JobTimeTrackerProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteLat, setSiteLat] = useState<number | null>(null);
  const [siteLng, setSiteLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const autoClockInDoneRef = useRef(false);
  const autoClockOutDoneRef = useRef(false);

  const geo = useGeofence(siteLat, siteLng);

  // Geocode the job address
  useEffect(() => {
    if (!jobAddress) return;
    setGeocoding(true);
    geocodeAddress(jobAddress).then((result) => {
      if (result) {
        setSiteLat(result.lat);
        setSiteLng(result.lng);
      }
      setGeocoding(false);
    });
  }, [jobAddress]);

  // Start GPS watching once site is geocoded
  useEffect(() => {
    if (siteLat !== null && siteLng !== null) {
      geo.startWatching();
    }
    return () => geo.stopWatching();
  }, [siteLat, siteLng]);

  // Fetch existing entries from interactions table
  const fetchEntries = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("interactions")
        .select("id, body, summary, created_at, created_by")
        .eq("lead_id", jobId)
        .eq("type", "time_entry")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Parse time entries from interactions
      const items: TimeEntry[] = (data || []).map((row: any) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(row.body || "{}");
        } catch {}
        return {
          id: row.id,
          clock_in: parsed.clock_in || row.created_at,
          clock_out: parsed.clock_out || null,
          is_auto: parsed.is_auto || false,
          notes: parsed.notes || null,
        };
      });

      setEntries(items);
      const active = items.find((e) => !e.clock_out);
      setActiveEntry(active || null);
    } catch (err) {
      console.error("Error fetching time entries:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Elapsed timer
  useEffect(() => {
    if (!activeEntry) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Date.now() - new Date(activeEntry.clock_in).getTime());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  // Auto clock-in when near site
  useEffect(() => {
    if (manualMode || !geo.isNearSite || activeEntry || autoClockInDoneRef.current) return;
    autoClockInDoneRef.current = true;
    clockIn(true);
  }, [geo.isNearSite, activeEntry, manualMode]);

  // Auto clock-out when leaving site
  useEffect(() => {
    if (manualMode || geo.isNearSite || !activeEntry || !activeEntry.is_auto || autoClockOutDoneRef.current) return;
    const timeout = setTimeout(() => {
      if (!geo.isNearSite && activeEntry) {
        autoClockOutDoneRef.current = true;
        clockOut(true);
      }
    }, 30000);
    return () => clearTimeout(timeout);
  }, [geo.isNearSite, activeEntry, manualMode]);

  // Reset auto flags when entry changes
  useEffect(() => {
    if (!activeEntry) {
      autoClockOutDoneRef.current = false;
    }
    if (activeEntry) {
      autoClockInDoneRef.current = true;
    }
  }, [activeEntry?.id]);

  const clockIn = async (isAuto: boolean) => {
    if (!user) return;
    try {
      const clockInTime = new Date().toISOString();
      const body = JSON.stringify({
        clock_in: clockInTime,
        clock_out: null,
        is_auto: isAuto,
        clock_in_lat: geo.lat,
        clock_in_lng: geo.lng,
      });

      const { data, error } = await supabase
        .from("interactions")
        .insert({
          lead_id: jobId,
          account_id: accountId || "",
          type: "time_entry",
          direction: "na",
          body,
          summary: `Clock in at ${format(new Date(clockInTime), "h:mm a")}`,
          created_by: user.id,
        })
        .select("id, body, created_at, created_by")
        .single();

      if (error) throw error;

      const entry: TimeEntry = {
        id: data.id,
        clock_in: clockInTime,
        clock_out: null,
        is_auto: isAuto,
        notes: null,
      };
      setActiveEntry(entry);
      setEntries((prev) => [entry, ...prev]);
      toast.success(isAuto ? "Auto clocked in — you're at the job site" : "Clocked in");
    } catch (err) {
      console.error("Clock in error:", err);
      toast.error("Failed to clock in");
    }
  };

  const clockOut = async (isAuto: boolean) => {
    if (!activeEntry) return;
    try {
      const clockOutTime = new Date().toISOString();
      const body = JSON.stringify({
        clock_in: activeEntry.clock_in,
        clock_out: clockOutTime,
        is_auto: activeEntry.is_auto,
        clock_out_lat: geo.lat,
        clock_out_lng: geo.lng,
      });

      const { error } = await supabase
        .from("interactions")
        .update({
          body,
          summary: `${format(new Date(activeEntry.clock_in), "h:mm a")} – ${format(new Date(clockOutTime), "h:mm a")}`,
        })
        .eq("id", activeEntry.id);

      if (error) throw error;
      toast.success(isAuto ? "Auto clocked out — you left the job site" : "Clocked out");
      setActiveEntry(null);
      fetchEntries();
    } catch {
      toast.error("Failed to clock out");
    }
  };

  // Calculate total time
  const totalMs = entries.reduce((sum, e) => {
    const start = new Date(e.clock_in).getTime();
    const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    return sum + (end - start);
  }, 0);

  const completedEntries = entries.filter((e) => e.clock_out);

  return (
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-secondary">
          <Clock className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">Log Your Hours</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading..." : `Total: ${formatDuration(totalMs)}`}
          </p>
        </div>

        {/* GPS status indicator */}
        <div className="flex items-center gap-1">
          {geocoding ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : geo.error ? (
            <div className="flex items-center gap-1 text-destructive" title={geo.error}>
              <WifiOff className="h-4 w-4" />
            </div>
          ) : geo.watching ? (
            <div
              className={`flex items-center gap-1 text-xs ${
                geo.isNearSite ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>{geo.isNearSite ? "On site" : "Away"}</span>
            </div>
          ) : siteLat === null && !geocoding ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" title="No address to geocode">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Active session */}
      {activeEntry && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md p-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                ⏱ Active Session
              </p>
              <p className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {formatDuration(elapsed)}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Started {format(new Date(activeEntry.clock_in), "h:mm a")}
                {activeEntry.is_auto && " (auto)"}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1"
              onClick={() => clockOut(false)}
            >
              <Square className="h-3.5 w-3.5" />
              Clock Out
            </Button>
          </div>
        </div>
      )}

      {/* Manual controls */}
      {!activeEntry && !loading && (
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            className="flex-1 gap-1"
            onClick={() => {
              setManualMode(true);
              clockIn(false);
            }}
          >
            <Play className="h-3.5 w-3.5" />
            Manual Clock In
          </Button>
        </div>
      )}

      {/* GPS info for manual toggle */}
      {!activeEntry && geo.error && (
        <p className="text-xs text-muted-foreground mb-3">
          GPS unavailable — use manual clock in/out.
        </p>
      )}

      {/* Past entries */}
      {completedEntries.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">History</p>
          {completedEntries.slice(0, 5).map((e) => {
            const dur = new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime();
            return (
              <div key={e.id} className="flex items-center justify-between text-sm py-1">
                <div>
                  <span className="text-foreground">
                    {format(new Date(e.clock_in), "MMM d")}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {format(new Date(e.clock_in), "h:mm a")} – {format(new Date(e.clock_out!), "h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{formatDuration(dur)}</span>
                  {e.is_auto && (
                    <span title="Auto-tracked"><Wifi className="h-3 w-3 text-muted-foreground" /></span>
                  )}
                </div>
              </div>
            );
          })}
          {completedEntries.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              +{completedEntries.length - 5} more entries
            </p>
          )}
        </div>
      )}
    </div>
  );
}
