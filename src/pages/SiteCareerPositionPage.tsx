import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Globe, Loader2, MapPin } from "lucide-react";
import type { WebsiteConfig, WebsiteHiringRole } from "@/hooks/useWebsiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { evaluateJobApplicationScreening } from "@/lib/jobApplicationScreening";
import {
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";
import { FONT_OPTIONS } from "@/pages/Website";

interface AccountData {
  company_name: string;
  company_email: string | null;
  logo_url: string | null;
  settings: Record<string, unknown> | null;
}

interface PublicSiteLookup extends AccountData {
  published: boolean;
}

type ApplicationFormData = {
  fullName: string;
  phoneNumber: string;
  email: string;
  city: string;
  reliableTransportation: "yes" | "no";
  yearsExperience: "0" | "1–2" | "3+";
  availableFullTime: "yes" | "no";
  expectedHourlyPay: string;
  whyHireYou: string;
};

function createEmptyApplicationFormData(): ApplicationFormData {
  return {
    fullName: "",
    phoneNumber: "",
    email: "",
    city: "",
    reliableTransportation: "yes",
    yearsExperience: "0",
    availableFullTime: "yes",
    expectedHourlyPay: "",
    whyHireYou: "",
  };
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "30, 58, 138";
}

function getOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export default function SiteCareerPositionPage() {
  const { accountId, roleId } = useParams<{ accountId: string; roleId: string }>();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [status, setStatus] = useState<"loading" | "not-found" | "unpublished" | "ready">("loading");
  const [formData, setFormData] = useState<ApplicationFormData>(createEmptyApplicationFormData());
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

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
  const roles = websiteConfig.hiring_roles ?? [];
  const decodedRoleId = useMemo(() => {
    if (!roleId) return "";
    try {
      return decodeURIComponent(roleId);
    } catch {
      return roleId;
    }
  }, [roleId]);
  const role = roles.find((item) => item.id === decodedRoleId) as WebsiteHiringRole | undefined;

  const themeColor = normalizeClientPortalColor(account?.settings?.client_portal_color);
  const themeTextColor = normalizeClientPortalTextColor(account?.settings?.client_portal_text_color);
  const rgb = hexToRgb(themeColor);

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

  const updateField = <K extends keyof ApplicationFormData>(field: K, value: ApplicationFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFormStatus("idle");
  };

  const submitApplication = async (e: FormEvent) => {
    e.preventDefault();
    if (!accountId || !role) return;

    setFormStatus("submitting");
    try {
      const screening = evaluateJobApplicationScreening({
        reliableTransportation: formData.reliableTransportation === "yes",
        availableFullTime: formData.availableFullTime === "yes",
        expectedHourlyPay: formData.expectedHourlyPay,
        acceptableHourlyPayMin: getOptionalNumber(role.acceptable_hourly_pay_min),
        acceptableHourlyPayMax: getOptionalNumber(role.acceptable_hourly_pay_max),
      });

      const { error } = await supabase.from("job_applications").insert({
        account_id: accountId,
        role_id: role.id,
        role_title: role.title,
        full_name: formData.fullName.trim(),
        phone_number: formData.phoneNumber.trim(),
        email: formData.email.trim(),
        city: formData.city.trim(),
        reliable_transportation: formData.reliableTransportation === "yes",
        landscaping_or_labor_experience: formData.yearsExperience,
        available_full_time: formData.availableFullTime === "yes",
        expected_hourly_pay: formData.expectedHourlyPay.trim(),
        why_hire_you: formData.whyHireYou.trim(),
        screening_tag: screening.tag,
        screening_stage: screening.stage,
        screening_reason: screening.reason,
      });

      if (error) throw error;
      setFormData(createEmptyApplicationFormData());
      setFormStatus("success");
    } catch {
      setFormStatus("error");
    }
  };

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

  if (!account || !accountId || !role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <Globe className="mb-4 h-12 w-12 text-gray-300" />
        <h1 className="text-xl font-semibold text-gray-700">Position not found</h1>
        <a href={`/site/${accountId}/careers`} className="mt-4 text-sm text-gray-600 underline">
          Back to Careers
        </a>
      </div>
    );
  }

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
        className="py-16"
        style={{ background: `linear-gradient(135deg, ${themeColor} 0%, rgba(${rgb}, 0.78) 100%)` }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <a
            href={`/site/${accountId}/careers`}
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: themeTextColor, opacity: 0.9 }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Careers
          </a>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}>
            {role.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" style={{ color: themeTextColor, opacity: 0.85 }}>
            {role.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {role.location}
              </span>
            )}
            {role.employment_type && <span>{role.employment_type}</span>}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-12">
        <div className="mx-auto max-w-5xl space-y-6 px-6">
          {role.description && (
            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900" style={fontCss ? { fontFamily: fontCss } : {}}>
                Position Details
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{role.description}</p>
            </article>
          )}

          <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900" style={fontCss ? { fontFamily: fontCss } : {}}>
              Apply for this Position
            </h2>

            <form className="mt-6 space-y-4" onSubmit={(e) => void submitApplication(e)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="full-name">Full Name</label>
                  <input
                    id="full-name"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="phone-number">Phone Number</label>
                  <input
                    id="phone-number"
                    value={formData.phoneNumber}
                    onChange={(e) => updateField("phoneNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="city">City</label>
                  <input
                    id="city"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="transportation">Do you have reliable transportation? (Yes/No)</label>
                  <select
                    id="transportation"
                    value={formData.reliableTransportation}
                    onChange={(e) => updateField("reliableTransportation", e.target.value as "yes" | "no")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="experience">How many years of landscaping or labor experience? (0 / 1–2 / 3+)</label>
                  <select
                    id="experience"
                    value={formData.yearsExperience}
                    onChange={(e) => updateField("yearsExperience", e.target.value as "0" | "1–2" | "3+")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="0">0</option>
                    <option value="1–2">1–2</option>
                    <option value="3+">3+</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="full-time">Are you available full-time? (Yes/No)</label>
                  <select
                    id="full-time"
                    value={formData.availableFullTime}
                    onChange={(e) => updateField("availableFullTime", e.target.value as "yes" | "no")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="hourly-pay">What hourly pay are you expecting?</label>
                  <input
                    id="hourly-pay"
                    value={formData.expectedHourlyPay}
                    onChange={(e) => updateField("expectedHourlyPay", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="why-hire-you">Why should we hire you? (Short answer)</label>
                <textarea
                  id="why-hire-you"
                  value={formData.whyHireYou}
                  onChange={(e) => updateField("whyHireYou", e.target.value)}
                  className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={formStatus === "submitting"}
                className="inline-flex rounded-full px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: themeColor, color: themeTextColor }}
              >
                {formStatus === "submitting" ? "Submitting..." : "Submit Application"}
              </button>

              {formStatus === "success" && (
                <p className="text-sm font-medium text-green-700">Application submitted successfully.</p>
              )}
              {formStatus === "error" && (
                <p className="text-sm font-medium text-red-600">Failed to submit application. Please try again.</p>
              )}

              {account.company_email && (
                <p className="text-sm text-gray-500">
                  Prefer email?{" "}
                  <a
                    href={`mailto:${account.company_email}?subject=Application%20for%20${encodeURIComponent(role.title)}`}
                    className="underline"
                  >
                    Apply by Email
                  </a>
                </p>
              )}
            </form>
          </article>
        </div>
      </section>
    </div>
  );
}
