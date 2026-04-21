import { useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

export type CalendarSyncAllResult = {
  synced: number;
  total: number;
  failed: number;
  firstError: string | null;
};

export function getLocalDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeCalendarSyncAllResult(data: unknown): CalendarSyncAllResult {
  const payload = (data ?? {}) as Record<string, unknown>;
  const synced = typeof payload.synced === 'number' && Number.isFinite(payload.synced) ? payload.synced : 0;
  const total = typeof payload.total === 'number' && Number.isFinite(payload.total) ? payload.total : 0;
  const failed = typeof payload.failed === 'number' && Number.isFinite(payload.failed) ? payload.failed : 0;
  const firstError = typeof payload.first_error === 'string' ? payload.first_error : null;
  return { synced, total, failed, firstError };
}

export async function syncAllCalendarJobs(accountId: string, todayDate: string = getLocalDateISO()): Promise<CalendarSyncAllResult> {
  const { data, error } = await supabase.functions.invoke('sync-job-to-calendar', {
    body: { action: 'syncAll', accountId, todayDate },
  });
  if (error) throw error;
  return normalizeCalendarSyncAllResult(data);
}

export async function startGoogleCalendarConnect(accountId: string | null, appUrl: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be signed in to connect Google Calendar');
  }

  const { data, error } = await supabase.functions.invoke('google-calendar-connect', {
    body: { accountId, appUrl },
  });

  if (error) throw error;
  return data;
}

function readGoogleCalendarFromProfileRow(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null;
  const fromColumn = row.google_calendar;
  if (fromColumn && typeof fromColumn === 'object') {
    return fromColumn as Record<string, unknown>;
  }

  const prefs = row.notification_preferences;
  if (prefs && typeof prefs === 'object') {
    const nested = (prefs as Record<string, unknown>).google_calendar;
    if (nested && typeof nested === 'object') {
      return nested as Record<string, unknown>;
    }
  }

  return null;
}

async function clearGoogleCalendarOnProfile(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ google_calendar: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (!error) return;

  const message = String(error.message || '');
  if (!message.toLowerCase().includes('google_calendar')) {
    throw error;
  }

  const { data: profileRow, error: loadError } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (loadError) throw loadError;

  const currentPrefs = (profileRow?.notification_preferences as Record<string, unknown> | null) ?? {};
  const { google_calendar: _removed, ...restPrefs } = currentPrefs;

  const { error: fallbackError } = await supabase
    .from('profiles')
    .update({ notification_preferences: restPrefs, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (fallbackError) throw fallbackError;
}

export function useGoogleCalendar() {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: gcal, isLoading: isLoadingGoogleCalendar } = useQuery({
    queryKey: ['profile-google-calendar', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return readGoogleCalendarFromProfileRow((data as Record<string, unknown> | null) ?? null);
    },
    enabled: !!user?.id,
  });

  const isConnected = !!gcal?.connected;
  const connectedEmail = typeof gcal?.connected_email === 'string' ? gcal.connected_email : null;

  // Handle OAuth redirect result on mount
  useEffect(() => {
    const status = searchParams.get('google_calendar');
    if (!status) return;

    if (status === 'connected') {
      toast.success('Google Calendar connected successfully');
      queryClient.invalidateQueries({ queryKey: ['profile-google-calendar', user?.id] });
    } else if (status === 'error') {
      const message = searchParams.get('message') || 'Failed to connect Google Calendar';
      toast.error(message);
    }

    // Clean up URL params
    const next = new URLSearchParams(searchParams);
    next.delete('google_calendar');
    next.delete('message');
    setSearchParams(next, { replace: true });
  }, [currentAccount?.id, queryClient, searchParams, setSearchParams, user?.id]);

  const connect = useMutation({
    mutationFn: async () => {
      const data = await startGoogleCalendarConnect(currentAccount?.id ?? null, window.location.origin);
      if (!data?.authUrl) throw new Error('Failed to get authorization URL');

      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start Google Calendar connection');
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user selected');
      await clearGoogleCalendarOnProfile(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-google-calendar', user?.id] });
      toast.success('Google Calendar disconnected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect Google Calendar');
    },
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      if (!currentAccount?.id) throw new Error('No account selected');
      return syncAllCalendarJobs(currentAccount.id);
    },
    onSuccess: (data) => {
      if (data.failed > 0 && data.synced === 0 && data.firstError) {
        toast.error(data.firstError);
        return;
      }

      if (data.failed > 0 && data.firstError) {
        toast.success(`Synced ${data.synced} of ${data.total} jobs (${data.failed} failed)`);
        toast.error(data.firstError);
        return;
      }

      toast.success(`Synced ${data.synced} of ${data.total} jobs to Google Calendar`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to sync jobs to Google Calendar');
    },
  });

  return {
    isConnected,
    connectedEmail,
    isLoadingGoogleCalendar,
    isConnecting: connect.isPending,
    isDisconnecting: disconnect.isPending,
    isSyncing: syncAll.isPending,
    connect: connect.mutate,
    connectAsync: connect.mutateAsync,
    disconnect: disconnect.mutate,
    disconnectAsync: disconnect.mutateAsync,
    syncAll: syncAll.mutate,
    syncAllAsync: syncAll.mutateAsync,
  };
}

export async function syncScheduleToCalendar(scheduleId: string) {
  try {
    const { error } = await supabase.functions.invoke('sync-job-to-calendar', {
      body: { action: 'upsert', scheduleId },
    });
    if (error) throw error;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('syncScheduleToCalendar failed:', message);
  }
}

export async function deleteScheduleFromCalendar(googleEventId: string, accountId: string) {
  try {
    const { error } = await supabase.functions.invoke('sync-job-to-calendar', {
      body: { action: 'delete', googleEventId, accountId },
    });
    if (error) throw error;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('deleteScheduleFromCalendar failed:', message);
  }
}
