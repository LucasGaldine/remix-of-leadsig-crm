import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type WebsiteService = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  price_per_unit?: number;
  unit_type?: string;
};

export type WebsiteConfig = {
  published?: boolean;
  font?: string;
  body_font?: string;
  hero?: {
    headline?: string;
    subheadline?: string;
    cta_text?: string;
  };
  calculator_enabled?: boolean;
  services?: WebsiteService[];
  about?: {
    text?: string;
  };
};

export function useWebsiteSettings() {
  const { currentAccount } = useAuth();
  const queryClient = useQueryClient();

  const { data: websiteConfig, isLoading } = useQuery({
    queryKey: ['website-settings', currentAccount?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('settings')
        .eq('id', currentAccount!.id)
        .single();
      if (error) throw error;
      const settings = data?.settings as Record<string, unknown> | null;
      return (settings?.website ?? {}) as WebsiteConfig;
    },
    enabled: !!currentAccount?.id,
  });

  const updateWebsite = useMutation({
    mutationFn: async (websiteUpdates: Partial<WebsiteConfig>) => {
      if (!currentAccount?.id) throw new Error('No account selected');

      const { data: existing } = await supabase
        .from('accounts')
        .select('settings')
        .eq('id', currentAccount.id)
        .single();

      const currentSettings = (existing?.settings as Record<string, unknown>) ?? {};
      const currentWebsite = (currentSettings.website as WebsiteConfig) ?? {};
      const nextWebsite = { ...currentWebsite, ...websiteUpdates };

      const { error } = await supabase
        .from('accounts')
        .update({
          settings: { ...currentSettings, website: nextWebsite },
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentAccount.id);

      if (error) throw error;
      return nextWebsite;
    },
    onSuccess: (data) => {
      if (!currentAccount?.id) return;
      queryClient.setQueryData(['website-settings', currentAccount.id], data);
      toast.success('Website saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    websiteConfig: websiteConfig ?? {},
    isLoading,
    updateWebsite: updateWebsite.mutate,
    updateWebsiteAsync: updateWebsite.mutateAsync,
    isSaving: updateWebsite.isPending,
  };
}
