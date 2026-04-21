import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AccountSettings = {
  daily_job_limit?: number | null;
  auto_qualify_integration_leads?: boolean | null;
  auto_qualify_reject_out_of_range?: boolean | null;
  auto_qualify_reject_out_of_budget?: boolean | null;
  auto_qualify_webhook?: {
    endpoint_url?: string;
    auth_header_name?: string;
    auth_header_value?: string;
  } | null;
  job_message_automation?: {
    enabled?: boolean;
    message_template?: string;
    message_templates?: Array<{
      id?: string;
      name?: string;
      content?: string;
      is_finished?: boolean;
      delivery_channel?: "text" | "email" | "both";
      send_email?: boolean;
      send_text?: boolean;
      job_service_types?: string[];
      trigger?: {
        type?: "immediate" | "before_schedule_start" | "after_schedule_start" | "after_job_completion";
        offset_minutes?: number;
        offset_value?: number;
        offset_unit?: "seconds" | "hours" | "days" | "months";
      };
    }>;
    job_service_types?: string[];
    trigger?: {
      type?: "immediate" | "before_schedule_start" | "after_schedule_start" | "after_job_completion";
      offset_minutes?: number;
      offset_value?: number;
      offset_unit?: "seconds" | "hours" | "days" | "months";
    };
    endpoint?: {
      enabled?: boolean;
      url?: string;
      auth_header_name?: string;
      auth_header_value?: string;
    };
    retry?: {
      max_attempts?: number;
      backoff_minutes?: number;
    };
    twilio?: {
      account_sid?: string;
      auth_token?: string;
      from_number?: string;
    };
    payment_emails?: {
      estimate_approved?: boolean;
      invoice_sent?: boolean;
      payment_logged?: boolean;
    };
  } | null;
  min_job_size?: Record<string, number> | null;
  service_areas?: Array<{
    location: string;
    radius_miles: number;
    lat?: number | null;
    lng?: number | null;
  }> | null;
  google_calendar?: {
    connected?: boolean;
    access_token?: string;
    refresh_token?: string;
    token_expiry?: string;
    calendar_id?: string;
    connected_email?: string;
    oauth_nonce?: string;
    oauth_nonce_created_at?: string;
  } | null;
} | null;

export function useAccountSettings() {
  const { currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['account-settings', currentAccount?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('settings')
        .eq('id', currentAccount!.id)
        .single();

      if (error) throw error;
      return (data?.settings as AccountSettings) ?? {};
    },
    enabled: !!currentAccount?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (partialSettings: Record<string, unknown>) => {
      if (!currentAccount?.id) throw new Error('No account selected');

      // Merge with the cached settings to avoid overwriting other keys.
      const current = (queryClient.getQueryData<AccountSettings>(['account-settings', currentAccount.id]) ?? {}) as Record<string, unknown>;
      const nextSettings = { ...current, ...partialSettings };

      const { data, error } = await supabase
        .from('accounts')
        .update({ settings: nextSettings, updated_at: new Date().toISOString() })
        .eq('id', currentAccount.id)
        .select('settings')
        .single();

      if (error) throw error;
      return data?.settings as AccountSettings;
    },
    onSuccess: (data) => {
      if (!currentAccount?.id) return;
      queryClient.setQueryData(['account-settings', currentAccount.id], data ?? {});
      toast.success('Settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    updateSettingsAsync: updateSettings.mutateAsync,
    isSaving: updateSettings.isPending,
  };
}
