import { useState, useEffect } from "react";
import {
  Phone, Mail, MapPin, CheckCircle2,
  Wrench, Hammer, Leaf, Droplets, Home, Zap,
  Paintbrush, Truck, Shield, Scissors, Sparkles, Star,
  Send, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WebsiteConfig } from "@/hooks/useWebsiteSettings";
import { FONT_OPTIONS, UNIT_OPTIONS } from "@/pages/Website";

const SERVICE_ICONS: Record<string, LucideIcon> = {
  CheckCircle2, Wrench, Hammer, Leaf, Droplets, Home, Zap,
  Paintbrush, Truck, Shield, Scissors, Sparkles, Star,
};

interface LandingPageViewProps {
  config: WebsiteConfig;
  themeColor: string;
  themeTextColor: string;
  companyName: string;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyAddress?: string | null;
  logoUrl?: string | null;
  accountId?: string;
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function unitShortLabel(unitType: string) {
  const opt = UNIT_OPTIONS.find((u) => u.value === unitType);
  if (!opt) return unitType;
  const parens = opt.label.match(/\(([^)]+)\)/);
  return parens ? parens[1] : opt.label;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "30, 58, 138";
}

export function LandingPageView({
  config,
  themeColor,
  themeTextColor,
  companyName,
  companyPhone,
  companyEmail,
  companyAddress,
  logoUrl,
  accountId,
}: LandingPageViewProps) {
  const rgb = hexToRgb(themeColor);

  const fontOption = FONT_OPTIONS.find((f) => f.name === config.font);
  const bodyFontOption = FONT_OPTIONS.find((f) => f.name === config.body_font);
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

  const [calcService, setCalcService] = useState("");
  const [calcQty, setCalcQty] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formService, setFormService] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const headline = config.hero?.headline || `Professional Services by ${companyName}`;
  const subheadline =
    config.hero?.subheadline ||
    "Quality work, reliable service, and results you can count on.";
  const ctaText = config.hero?.cta_text || "Get a Free Quote";
  const aboutText =
    config.about?.text ||
    `${companyName} is committed to delivering top-quality service. We take pride in our work and treat every job as if it were our own home.`;
  const services = config.services ?? [];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      setFormStatus("success");
      return;
    }
    setFormStatus("submitting");
    try {
      const { error } = await supabase.functions.invoke("website-lead-submit", {
        body: {
          account_id: accountId,
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          service_type: formService || undefined,
          notes: formMessage || undefined,
        },
      });
      if (error) throw error;
      setFormStatus("success");
    } catch {
      setFormStatus("error");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 transition-shadow";

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased" style={bodyFontCss ? { fontFamily: bodyFontCss } : {}}>
      {/* Sticky nav */}
      <header
        className="sticky top-0 z-50 border-b shadow-sm"
        style={{ backgroundColor: themeColor, borderColor: `rgba(${hexToRgb(themeTextColor)}, 0.1)` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${companyName} logo`}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <span className="text-lg font-bold" style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}>
                {companyName}
              </span>
            )}
            {logoUrl && (
              <span
                className="hidden text-sm font-semibold sm:block"
                style={{ color: themeTextColor, opacity: 0.8 }}
              >
                {companyName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => scrollTo("services")}
              className="hidden text-sm font-medium transition-opacity hover:opacity-100 sm:block"
              style={{ color: themeTextColor, opacity: 0.75 }}
            >
              Services
            </button>
            <button
              onClick={() => scrollTo("about")}
              className="hidden text-sm font-medium transition-opacity hover:opacity-100 sm:block"
              style={{ color: themeTextColor, opacity: 0.75 }}
            >
              About
            </button>
            <button
              onClick={() => scrollTo("contact")}
              className="rounded-full px-4 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeTextColor, color: themeColor }}
            >
              Contact Us
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden py-24 sm:py-32"
        style={{
          background: `linear-gradient(135deg, ${themeColor} 0%, rgba(${rgb}, 0.75) 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h1
            className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl"
            style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}
          >
            {headline}
          </h1>
          <p
            className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl"
            style={{ color: themeTextColor, opacity: 0.8 }}
          >
            {subheadline}
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => scrollTo("contact")}
              className="w-full rounded-full px-8 py-3.5 text-base font-bold shadow-lg transition-transform hover:scale-105 sm:w-auto"
              style={{ backgroundColor: themeTextColor, color: themeColor }}
            >
              {ctaText}
            </button>
            {services.length > 0 && (
              <button
                onClick={() => scrollTo("services")}
                className="w-full rounded-full border-2 px-8 py-3.5 text-base font-semibold transition-opacity hover:opacity-100 sm:w-auto"
                style={{
                  borderColor: `rgba(${hexToRgb(themeTextColor)}, 0.5)`,
                  color: themeTextColor,
                  opacity: 0.85,
                }}
              >
                Our Services
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Services */}
      {services.length > 0 && (
        <section id="services" className="bg-gray-50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl" style={fontCss ? { fontFamily: fontCss } : {}}>What We Offer</h2>
              <p className="mt-3 text-gray-500">Reliable services tailored to your needs</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => {
                const Icon =
                  service.icon && SERVICE_ICONS[service.icon]
                    ? SERVICE_ICONS[service.icon]
                    : CheckCircle2;
                return (
                  <div
                    key={service.id}
                    className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div
                      className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `rgba(${rgb}, 0.1)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: themeColor }} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900" style={fontCss ? { fontFamily: fontCss } : {}}>{service.name}</h3>
                    {service.description && (
                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        {service.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      <section id="about" className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl" style={fontCss ? { fontFamily: fontCss } : {}}>About Us</h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">{aboutText}</p>
        </div>
      </section>

      {/* Estimate Calculator */}
      {config.calculator_enabled && services.some((s) => s.price_per_unit) && (() => {
        const calcServices = services.filter((s) => s.price_per_unit);
        const selected = calcServices.find((s) => s.name === calcService) ?? calcServices[0];
        const qty = parseFloat(calcQty);
        const hasQty = !isNaN(qty) && qty > 0;
        const base = hasQty && selected?.price_per_unit ? selected.price_per_unit * qty : null;
        const low = base ? base * 0.85 : null;
        const high = base ? base * 1.15 : null;
        const fmt = (n: number) =>
          n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
        return (
          <section id="estimate" className="bg-gray-50 py-20">
            <div className="mx-auto max-w-3xl px-6">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl" style={fontCss ? { fontFamily: fontCss } : {}}>
                  Estimate Your Project
                </h2>
                <p className="mt-3 text-gray-500">Get a ballpark figure in seconds</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Service selector */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Service
                    </label>
                    <select
                      value={calcService || selected?.name || ""}
                      onChange={(e) => setCalcService(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 transition-shadow"
                      style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                    >
                      {calcServices.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity input */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {selected?.unit_type ? `Quantity (${unitShortLabel(selected.unit_type)})` : "Quantity"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={calcQty}
                      onChange={(e) => setCalcQty(e.target.value)}
                      placeholder={`Enter ${selected?.unit_type ? unitShortLabel(selected.unit_type) : "quantity"}…`}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 transition-shadow"
                      style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Result */}
                <div className="mt-6 rounded-xl p-6 text-center" style={{ backgroundColor: `rgba(${rgb}, 0.07)` }}>
                  {low && high ? (
                    <>
                      <p className="text-sm text-gray-500">Estimated range</p>
                      <p className="mt-1 text-4xl font-extrabold" style={{ color: themeColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}>
                        {fmt(low)} – {fmt(high)}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        Based on {calcQty} {selected?.unit_type ? unitShortLabel(selected.unit_type) : "units"} of {selected?.name}. Actual price may vary.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">
                      {calcServices.length === 1
                        ? `Enter a quantity above to see your estimate`
                        : `Select a service and enter a quantity to see your estimate`}
                    </p>
                  )}
                </div>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      if (selected) setFormService(selected.name);
                      scrollTo("contact");
                    }}
                    className="rounded-full px-8 py-3 text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: themeColor, color: themeTextColor }}
                  >
                    Request an Exact Quote
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Contact — two-column: info left, form right */}
      <section id="contact" className="py-20" style={{ backgroundColor: `rgba(${rgb}, 0.05)` }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl" style={fontCss ? { fontFamily: fontCss } : {}}>Get in Touch</h2>
            <p className="mt-3 text-gray-500">We'd love to hear from you</p>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Left — contact info */}
            <div className="flex flex-col gap-4">
              {companyPhone && (
                <a
                  href={`tel:${companyPhone}`}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `rgba(${rgb}, 0.1)` }}
                  >
                    <Phone className="h-6 w-6" style={{ color: themeColor }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Call Us</p>
                    <p className="text-lg font-bold text-gray-900">{formatPhone(companyPhone)}</p>
                  </div>
                </a>
              )}
              {companyEmail && (
                <a
                  href={`mailto:${companyEmail}`}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `rgba(${rgb}, 0.1)` }}
                  >
                    <Mail className="h-6 w-6" style={{ color: themeColor }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</p>
                    <p className="font-semibold text-gray-900">{companyEmail}</p>
                  </div>
                </a>
              )}
              {companyAddress && (
                <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `rgba(${rgb}, 0.1)` }}
                  >
                    <MapPin className="h-6 w-6" style={{ color: themeColor }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Address</p>
                    <p className="font-semibold text-gray-900">{companyAddress}</p>
                  </div>
                </div>
              )}
              {!companyPhone && !companyEmail && !companyAddress && (
                <div className="rounded-2xl border border-gray-100 bg-white px-6 py-8 text-center shadow-sm">
                  <p className="text-gray-500">Fill out the form to get in touch with us.</p>
                </div>
              )}
            </div>

            {/* Right — request a project form */}
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
              <h3 className="mb-6 text-xl font-bold text-gray-900" style={fontCss ? { fontFamily: fontCss } : {}}>Request a Project</h3>

              {formStatus === "success" ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: `rgba(${rgb}, 0.12)` }}
                  >
                    <CheckCircle2 className="h-7 w-7" style={{ color: themeColor }} />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Request received!</p>
                  <p className="text-sm text-gray-500">
                    We'll be in touch shortly to discuss your project.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Jane Smith"
                        className={inputClass}
                        style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="(555) 000-0000"
                        className={inputClass}
                        style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className={inputClass}
                      style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                    />
                  </div>

                  {services.length > 0 && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Service
                      </label>
                      <select
                        value={formService}
                        onChange={(e) => setFormService(e.target.value)}
                        className={inputClass}
                        style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                      >
                        <option value="">Select a service…</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Tell us about your project
                    </label>
                    <textarea
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      placeholder="Describe what you need, where it's located, and any other details…"
                      rows={4}
                      className={`${inputClass} resize-none`}
                      style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                    />
                  </div>

                  {formStatus === "error" && (
                    <p className="text-sm text-red-500">
                      Something went wrong. Please try again or call us directly.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={formStatus === "submitting"}
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: themeColor, color: themeTextColor }}
                  >
                    <Send className="h-4 w-4" />
                    {formStatus === "submitting" ? "Sending…" : "Send Request"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm" style={{ backgroundColor: themeColor }}>
        <p style={{ color: themeTextColor, opacity: 0.7 }}>
          &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
        </p>
        <p className="mt-1 text-xs" style={{ color: themeTextColor, opacity: 0.35 }}>
          Powered by LeadSig
        </p>
      </footer>
    </div>
  );
}
