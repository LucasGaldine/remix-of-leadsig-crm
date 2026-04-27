import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type WebsiteService = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  image_url?: string | null;
  enabled?: boolean;
  price_per_unit?: number;
  unit_type?: string;
};

export type WebsiteHiringRole = {
  id: string;
  title: string;
  status?: string;
  urgency?: "low" | "normal" | "high" | string;
  version?: string | number;
  updated_at?: string;
  location?: string;
  employment_type?: string;
  description?: string;
  acceptable_hourly_pay_min?: number | null;
  acceptable_hourly_pay_max?: number | null;
  auto_reject?: WebsiteHiringAutoRejectSettings;
};

export type WebsiteHiringAutoRejectSettings = {
  transportation_enabled?: boolean;
  availability_enabled?: boolean;
  pay_expectation_enabled?: boolean;
};

export type WebsiteTestimonial = {
  id: string;
  heading: string;
  quote: string;
  author: string;
  location: string;
  photo_url?: string | null;
};

export type WebsiteConfig = {
  published?: boolean;
  custom_domain?: string;
  hiring_roles?: WebsiteHiringRole[];
  font?: string;
  body_font?: string;
  hero?: {
    headline?: string;
    subheadline?: string;
    cta_text?: string;
    header_image_url?: string | null;
  };
  calculator_enabled?: boolean;
  services?: WebsiteService[];
  services_section?: {
    header?: string;
    subheading?: string;
  };
  testimonials_section?: {
    header?: string;
    subheading?: string;
  };
  about?: {
    heading?: string;
    subheading?: string;
    text?: string;
    before_image_url?: string | null;
    after_image_url?: string | null;
  };
  testimonials?: WebsiteTestimonial[];
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
