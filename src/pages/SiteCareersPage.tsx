import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Briefcase, Globe, Loader2, MapPin } from "lucide-react";
import type { WebsiteConfig } from "@/hooks/useWebsiteSettings";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";
import { FONT_OPTIONS } from "@/pages/Website";

interface AccountData {
  company_name: string;
  logo_url: string | null;
  settings: Record<string, unknown> | null;
}

interface PublicSiteLookup extends AccountData {
  published: boolean;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "30, 58, 138";
}

export default function SiteCareersPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [status, setStatus] = useState<"loading" | "not-found" | "unpublished" | "ready">("loading");

  useEffect(() => {
    if (!accountId) {
      setStatus("not-found");
      return;
    }

    supabase.rpc("get_public_site", { account_uuid: accountId }).then(({ data, error }) => {
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

  const websiteConfig = (account?.settings?.website ?? {}) as WebsiteConfig;
  const themeColor = normalizeClientPortalColor(account?.settings?.client_portal_color);
  const themeTextColor = normalizeClientPortalTextColor(account?.settings?.client_portal_text_color);
  const rgb = hexToRgb(themeColor);
  const roles = websiteConfig.hiring_roles ?? [];
  const fontOption = FONT_OPTIONS.find((f) => f.name === websiteConfig.font);
  const bodyFontOption = FONT_OPTIONS.find((f) => f.name === websiteConfig.body_font);
  const fontCss = fontOption?.css;
  const bodyFontCss = bodyFontOption?.css;

  const loadGoogleFont = (option: typeof fontOption) => {
    if (!option) return;
    const id = `gfont-${option.name.replace(/\s+/g, "-").toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${option.googleParam}&display=swap`;
    document.head.appendChild(link);
  };

  useEffect(() => { loadGoogleFont(fontOption); }, [fontOption]);
  useEffect(() => { loadGoogleFont(bodyFontOption); }, [bodyFontOption]);

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
      </div>
    );
  }

  if (!account || !accountId) return null;

  return (
    <div className="min-h-screen bg-white text-gray-900" style={bodyFontCss ? { fontFamily: bodyFontCss } : {}}>
      <header
        className="sticky top-0 z-50 border-b shadow-sm"
        style={{ backgroundColor: themeColor, borderColor: `rgba(${hexToRgb(themeTextColor)}, 0.1)` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            {account.logo_url ? (
              <img src={account.logo_url} alt={`${account.company_name} logo`} className="h-9 w-auto object-contain" />
            ) : (
              <span className="text-lg font-bold" style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}>
                {account.company_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <a href={`/site/${accountId}`} style={{ color: themeTextColor, opacity: 0.85 }}>
              Home
            </a>
            <a href={`/site/${accountId}/careers`} style={{ color: themeTextColor }}>
              Careers
            </a>
          </div>
        </div>
      </header>

      <section
        className="py-20"
        style={{ background: `linear-gradient(135deg, ${themeColor} 0%, rgba(${rgb}, 0.78) 100%)` }}
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1
            className="text-4xl font-extrabold tracking-tight sm:text-5xl"
            style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}
          >
            Careers at {account.company_name}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg" style={{ color: themeTextColor, opacity: 0.85 }}>
            Join our team and help us deliver great work for our customers.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          {roles.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <Briefcase className="mx-auto h-10 w-10 text-gray-400" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900" style={fontCss ? { fontFamily: fontCss } : {}}>No openings right now</h2>
              <p className="mt-2 text-sm text-gray-500">
                Check back soon for new opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {roles.map((role) => (
                <article key={role.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-gray-900" style={fontCss ? { fontFamily: fontCss } : {}}>{role.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    {role.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {role.location}
                      </span>
                    )}
                    {role.employment_type && <span>{role.employment_type}</span>}
                  </div>
                  {role.description && (
                    <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                      {role.description}
                    </p>
                  )}

                  <a
                    href={`/site/${accountId}/careers/${encodeURIComponent(role.id)}`}
                    className="mt-5 inline-flex rounded-full px-5 py-2 text-sm font-semibold"
                    style={{ backgroundColor: themeColor, color: themeTextColor }}
                  >
                    View Position
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
