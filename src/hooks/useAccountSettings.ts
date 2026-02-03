import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AccountSettings = {
  daily_job_limit?: number | null;
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
      toast.success('Availability settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    isSaving: updateSettings.isPending,
  };
}

