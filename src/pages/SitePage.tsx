import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandingPageView } from "@/components/website/LandingPageView";
import type { WebsiteConfig } from "@/hooks/useWebsiteSettings";
import {
  normalizeClientPortalColor,
  normalizeClientPortalHighlightColor,
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

function upsertMetaTag(attribute: "name" | "property", key: string, value: string): HTMLMetaElement {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", value);
  return element;
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

  useEffect(() => {
    if (status !== "ready" || !account) return;

    const previousTitle = document.title;
    const previousDescription = (
      document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null
    )?.content;
    const previousOgTitle = (
      document.head.querySelector('meta[property="og:title"]') as HTMLMetaElement | null
    )?.content;
    const previousOgDescription = (
      document.head.querySelector('meta[property="og:description"]') as HTMLMetaElement | null
    )?.content;
    const previousOgUrl = (
      document.head.querySelector('meta[property="og:url"]') as HTMLMetaElement | null
    )?.content;
    const previousTwitterTitle = (
      document.head.querySelector('meta[name="twitter:title"]') as HTMLMetaElement | null
    )?.content;
    const previousTwitterDescription = (
      document.head.querySelector('meta[name="twitter:description"]') as HTMLMetaElement | null
    )?.content;
    const previousAuthor = (
      document.head.querySelector('meta[name="author"]') as HTMLMetaElement | null
    )?.content;

    const websiteConfig = (account.settings?.website ?? {}) as WebsiteConfig;
    const companyName = account.company_name || "Business";
    const headline = websiteConfig.hero?.headline?.trim();
    const subheadline = websiteConfig.hero?.subheadline?.trim();
    const title = headline || `${companyName}`;
    const description = subheadline || `Professional services by ${companyName}.`;
    const canonicalUrl = window.location.href;

    document.title = title;
    upsertMetaTag("name", "description", description);
    upsertMetaTag("name", "author", companyName);
    upsertMetaTag("property", "og:title", title);
    upsertMetaTag("property", "og:description", description);
    upsertMetaTag("property", "og:url", canonicalUrl);
    upsertMetaTag("name", "twitter:title", title);
    upsertMetaTag("name", "twitter:description", description);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== undefined) upsertMetaTag("name", "description", previousDescription);
      if (previousOgTitle !== undefined) upsertMetaTag("property", "og:title", previousOgTitle);
      if (previousOgDescription !== undefined) upsertMetaTag("property", "og:description", previousOgDescription);
      if (previousOgUrl !== undefined) upsertMetaTag("property", "og:url", previousOgUrl);
      if (previousTwitterTitle !== undefined) upsertMetaTag("name", "twitter:title", previousTwitterTitle);
      if (previousTwitterDescription !== undefined) upsertMetaTag("name", "twitter:description", previousTwitterDescription);
      if (previousAuthor !== undefined) upsertMetaTag("name", "author", previousAuthor);
    };
  }, [account, status]);

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
  const themeHighlightColor = normalizeClientPortalHighlightColor(account.settings?.client_portal_highlight_color);

  return (
    <LandingPageView
      config={websiteConfig}
      themeColor={themeColor}
      themeTextColor={themeTextColor}
      themeHighlightColor={themeHighlightColor}
      companyName={account.company_name}
      companyPhone={account.company_phone}
      companyEmail={account.company_email}
      companyAddress={account.company_address}
      logoUrl={account.logo_url}
      accountId={accountId}
    />
  );
}
