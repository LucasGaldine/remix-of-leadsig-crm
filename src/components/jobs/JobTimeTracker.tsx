import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Square,
  Wifi,
  WifiOff,
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
  embedded?: boolean;
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

export function JobTimeTracker({ jobId, jobAddress, accountId, embedded = false }: JobTimeTrackerProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteLat, setSiteLat] = useState<number | null>(null);
  const [siteLng, setSiteLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [tableExists, setTableExists] = useState(true);
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

  // Fetch existing entries
  const fetchEntries = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("job_time_entries")
        .select("id, clock_in, clock_out, is_auto, notes")
        .eq("lead_id", jobId)
        .eq("user_id", user.id)
        .order("clock_in", { ascending: false });

      if (error) {
        // Table doesn't exist on this database
        if (error.code === "PGRST205" || error.message?.includes("Could not find")) {
          setTableExists(false);
          setLoading(false);
          return;
        }
        throw error;
      }

      const items = (data || []) as TimeEntry[];
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
    if (manualMode || !geo.isNearSite || activeEntry || autoClockInDoneRef.current || !tableExists) return;
    autoClockInDoneRef.current = true;
    clockIn(true);
  }, [geo.isNearSite, activeEntry, manualMode, tableExists]);

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
    if (!user || !tableExists) return;
    try {
      const { data, error } = await supabase
        .from("job_time_entries")
        .insert({
          lead_id: jobId,
          user_id: user.id,
          account_id: accountId || "",
          clock_in: new Date().toISOString(),
          is_auto: isAuto,
          clock_in_lat: geo.lat,
          clock_in_lng: geo.lng,
        })
        .select("id, clock_in, clock_out, is_auto, notes")
        .single();

      if (error) throw error;
      setActiveEntry(data as TimeEntry);
      setEntries((prev) => [data as TimeEntry, ...prev]);
      toast.success(isAuto ? "Auto clocked in — you're at the job site" : "Clocked in");
    } catch (err) {
      console.error("Clock in error:", err);
      toast.error("Failed to clock in");
    }
  };

  const clockOut = async (isAuto: boolean) => {
    if (!activeEntry) return;
    try {
      const { error } = await supabase
        .from("job_time_entries")
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: geo.lat,
          clock_out_lng: geo.lng,
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

  const completedEntries = entries.filter((e) => e.clock_out);

  if (!tableExists) {
    return (
      <div className={embedded ? "py-1" : "card-elevated rounded-lg p-4"}>
        <p className="text-sm text-muted-foreground">
          Time tracking requires the <code className="text-xs bg-muted px-1 py-0.5 rounded">job_time_entries</code> table. Please run the setup SQL on your database.
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="h-4 w-4 shrink-0 text-destructive" />
          <span>No GPS - use manual clock in/out.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "py-1" : "card-elevated rounded-lg p-4"}>
      {/* Active session */}
      {activeEntry && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md p-3 ">
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

      {/* Clock In button */}
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
            Clock In
          </Button>
        </div>
      )}

      {/* GPS info for manual toggle */}
      {!activeEntry && geo.error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="h-4 w-4 shrink-0 text-destructive" />
          <span>No GPS - use manual clock in/out.</span>
        </div>
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
