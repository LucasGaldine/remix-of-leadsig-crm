import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getLocalDateISO, syncAllCalendarJobs } from '@/hooks/useGoogleCalendar';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function getLastSyncedKey(userId: string, accountId: string): string {
  return `gcal-auto-sync-last-${userId}-${accountId}`;
}

function isGoogleCalendarConnected(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  const fromColumn = row.google_calendar;
  if (fromColumn && typeof fromColumn === 'object') {
    return !!(fromColumn as Record<string, unknown>).connected;
  }

  const prefs = row.notification_preferences;
  if (prefs && typeof prefs === 'object') {
    const nested = (prefs as Record<string, unknown>).google_calendar;
    if (nested && typeof nested === 'object') {
      return !!(nested as Record<string, unknown>).connected;
    }
  }
  return false;
}

export function GoogleCalendarAutoSync() {
  const { user, currentAccount } = useAuth();
  const syncInFlightRef = useRef(false);

  const { data: isConnected } = useQuery({
    queryKey: ['profile-google-calendar', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return isGoogleCalendarConnected((data as Record<string, unknown> | null) ?? null);
    },
    enabled: !!user?.id,
  });

  const storageKey = useMemo(() => {
    if (!user?.id || !currentAccount?.id) return null;
    return getLastSyncedKey(user.id, currentAccount.id);
  }, [currentAccount?.id, user?.id]);

  useEffect(() => {
    if (!storageKey || !currentAccount?.id || !isConnected) return;

    const runAutoSync = async (force = false) => {
      if (syncInFlightRef.current) return;

      if (!force) {
        const lastSyncedAtRaw = localStorage.getItem(storageKey);
        const lastSyncedAt = lastSyncedAtRaw ? Number(lastSyncedAtRaw) : 0;
        if (Number.isFinite(lastSyncedAt) && Date.now() - lastSyncedAt < AUTO_SYNC_INTERVAL_MS) {
          return;
        }
      }

      syncInFlightRef.current = true;
      try {
        await syncAllCalendarJobs(currentAccount.id, getLocalDateISO());
        localStorage.setItem(storageKey, String(Date.now()));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown calendar sync error';
        console.warn('Google calendar auto-sync failed:', message);
      } finally {
        syncInFlightRef.current = false;
      }
    };

    void runAutoSync();

    const intervalId = window.setInterval(() => {
      void runAutoSync();
    }, AUTO_SYNC_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runAutoSync();
      }
    };
    const onWindowFocus = () => {
      void runAutoSync();
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentAccount?.id, isConnected, storageKey]);

  return null;
}
