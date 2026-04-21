import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandingPageView } from "@/components/website/LandingPageView";
import type { WebsiteConfig } from "@/hooks/useWebsiteSettings";
import {
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";

interface AccountData {
  company_name: string;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  logo_url: string | null;
  settings: Record<string, unknown> | null;
}

interface PublicSiteLookup extends AccountData {
  published: boolean;
}

export default function SitePage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [status, setStatus] = useState<"loading" | "not-found" | "unpublished" | "ready">(
    "loading"
  );

  useEffect(() => {
    if (!accountId) {
      setStatus("not-found");
      return;
    }

    supabase
      .rpc("get_public_site", { account_uuid: accountId })
      .then(({ data, error }) => {
        const site = (Array.isArray(data) ? data[0] : data) as PublicSiteLookup | null;
        if (error || !site) {
          setStatus("not-found");
          return;
        }

        if (!site.published) {
          setStatus("unpublished");
          return;
        }

        setAccount(site);
        setStatus("ready");
      });
  }, [accountId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (status === "not-found" || status === "unpublished") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <Globe className="mb-4 h-12 w-12 text-gray-300" />
        <h1 className="text-xl font-semibold text-gray-700">
          {status === "not-found" ? "Site not found" : "This site isn't published yet"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {status === "not-found"
            ? "Check the link and try again."
            : "The business hasn't published their site yet."}
        </p>
      </div>
    );
  }

  if (!account) return null;

  const websiteConfig = (account.settings?.website ?? {}) as WebsiteConfig;
  const themeColor = normalizeClientPortalColor(account.settings?.client_portal_color);
  const themeTextColor = normalizeClientPortalTextColor(account.settings?.client_portal_text_color);

  return (
    <LandingPageView
      config={websiteConfig}
      themeColor={themeColor}
      themeTextColor={themeTextColor}
      companyName={account.company_name}
      companyPhone={account.company_phone}
      companyEmail={account.company_email}
      companyAddress={account.company_address}
      logoUrl={account.logo_url}
      accountId={accountId}
    />
  );
}
