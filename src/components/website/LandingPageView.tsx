import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Phone, Mail, MapPin, CheckCircle2,
  Wrench, HardHat, Leaf, Droplets, Home, Zap,
  Paintbrush, Truck, Shield, Scissors, Sparkles, Star,
  Send, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WebsiteConfig, WebsiteTestimonial } from "@/hooks/useWebsiteSettings";
import { UNIT_OPTIONS } from "@/pages/Website";
import { getBrandFontOption, loadGoogleBrandFont } from "@/lib/brandFonts";
import { parseHighlightSegments } from "@/lib/highlightText";

const SERVICE_ICONS: Record<string, LucideIcon> = {
  CheckCircle2, Wrench, HardHat, Leaf, Droplets, Home, Zap,
  Paintbrush, Truck, Shield, Scissors, Sparkles, Star,
};

interface LandingPageViewProps {
  config: WebsiteConfig;
  themeColor: string;
  themeTextColor: string;
  themeHighlightColor: string;
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

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  const hasCountryCode = digits.length > 10 && digits[0] === "1";
  const local = hasCountryCode ? digits.slice(1) : digits;

  if (local.length <= 3) return hasCountryCode ? `+1 (${local}` : `(${local}`;
  if (local.length <= 6) return hasCountryCode ? `+1 (${local.slice(0, 3)}) ${local.slice(3)}` : `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return hasCountryCode
    ? `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`
    : `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;
}

function toPhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const EMAIL_PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$";

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

function hexToHsl(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) {
    return { h: 221, s: 64, l: 33 };
  }

  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

function getTestimonialInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "C";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "C";
}

export function LandingPageView({
  config,
  themeColor,
  themeTextColor,
  themeHighlightColor,
  companyName,
  companyPhone,
  companyEmail,
  companyAddress,
  logoUrl,
  accountId,
}: LandingPageViewProps) {
  const rgb = hexToRgb(themeColor);
  const hsl = hexToHsl(themeColor);
  const heroDarkStart = `hsla(${hsl.h} ${hsl.s}% ${Math.max(hsl.l - 24, 12)}% / 0.88)`;
  const heroDarkEnd = `hsla(${hsl.h} ${hsl.s}% ${Math.max(hsl.l - 14, 16)}% / 0.78)`;
  const heroSolidStart = `hsl(${hsl.h} ${hsl.s}% ${Math.max(hsl.l - 18, 16)}%)`;
  const heroSolidEnd = `hsl(${hsl.h} ${hsl.s}% ${Math.max(hsl.l - 8, 20)}%)`;

  const fontOption = getBrandFontOption(config.font);
  const bodyFontOption = getBrandFontOption(config.body_font);
  const fontCss = fontOption?.css;
  const bodyFontCss = bodyFontOption?.css;

  useEffect(() => { loadGoogleBrandFont(fontOption); }, [fontOption]);
  useEffect(() => { loadGoogleBrandFont(bodyFontOption); }, [bodyFontOption]);

  const [calcService, setCalcService] = useState("");
  const [calcQty, setCalcQty] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSmsConsent, setFormSmsConsent] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const pageRef = useRef<HTMLDivElement | null>(null);

  const headline = config.hero?.headline || `Professional Services by ${companyName}`;
  const subheadline =
    config.hero?.subheadline ||
    "Quality work, reliable service, and results you can count on.";
  const ctaText = config.hero?.cta_text || "Get a Free Quote";
  const heroImageUrl = config.hero?.header_image_url || "";
  const aboutHeading = config.about?.heading || "About Us";
  const aboutSubheading = config.about?.subheading || "";
  const aboutText =
    config.about?.text ||
    `${companyName} is committed to delivering top-quality service. We take pride in our work and treat every job as if it were our own home.`;
  const aboutBeforeImageUrl = config.about?.before_image_url || "";
  const aboutAfterImageUrl = config.about?.after_image_url || "";
  const hasBeforeAfterImages = Boolean(aboutBeforeImageUrl && aboutAfterImageUrl);
  const servicesHeader = config.services_section?.header || "What We Offer";
  const servicesSubheading = config.services_section?.subheading || "Reliable services tailored to your needs";
  const services = (config.services ?? []).filter((service) => service.enabled !== false);
  const testimonials: WebsiteTestimonial[] = (config.testimonials && config.testimonials.length > 0)
    ? config.testimonials
    : [
        {
          id: "testimonial-1",
          heading: "Easy, Transparent Process",
          quote: `${companyName} made the whole process easy. Great communication, fair pricing, and the final result was excellent.`,
          author: "Sarah M.",
          location: "Homeowner",
          photo_url: null,
        },
        {
          id: "testimonial-2",
          heading: "On Time and Professional",
          quote: "The team showed up on time, worked efficiently, and left everything spotless. I would absolutely hire them again.",
          author: "David R.",
          location: "Property Manager",
          photo_url: null,
        },
        {
          id: "testimonial-3",
          heading: "High-Quality Results",
          quote: "From the first call to project completion, they were professional and detail-oriented. Highly recommended.",
          author: "Priya K.",
          location: "Local Business Owner",
          photo_url: null,
        },
      ];
  const testimonialsHeader = config.testimonials_section?.header || "What Contacts Say";
  const testimonialsSubheading =
    config.testimonials_section?.subheading || "Trusted by homeowners and businesses in the area";

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const revealElements = Array.from(page.querySelectorAll<HTMLElement>("[data-site-reveal]"));
    if (revealElements.length === 0) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("site-reveal-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("site-reveal-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0,
        rootMargin: "0px",
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [config, services.length, testimonials.length]);

  const [aboutSliderPosition, setAboutSliderPosition] = useState(50);

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
      const { data, error } = await supabase.functions.invoke("website-lead-submit", {
        body: {
          account_id: accountId,
          name: formName,
          email: formEmail,
          phone: toPhoneDigits(formPhone),
          sms_consent: formSmsConsent,
        },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "success" in data && (data as { success?: boolean }).success === false) {
        console.error("website-lead-submit returned unsuccessful response", data);
        throw new Error(
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Lead submission failed",
        );
      }
      setFormStatus("success");
    } catch {
      setFormStatus("error");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 transition-shadow";

  const renderHighlightedText = (text: string): ReactNode =>
    parseHighlightSegments(text).map((segment, index) => {
      if (!segment.highlighted && !segment.brandColored) return <span key={index}>{segment.text}</span>;
      if (segment.brandColored) {
        return (
          <span key={index} style={{ color: themeColor }}>
            {segment.text}
          </span>
        );
      }
      return (
        <span key={index} style={{ color: themeHighlightColor }}>
          {segment.text}
        </span>
      );
    });

  return (
    <div ref={pageRef} className="min-h-screen bg-white font-sans text-gray-900 antialiased" style={bodyFontCss ? { fontFamily: bodyFontCss } : {}}>
      {/* Sticky nav */}
      <header
        className="sticky top-0 z-50 border-b shadow-sm"
        style={{ backgroundColor: themeColor, borderColor: `rgba(${hexToRgb(themeTextColor)}, 0.1)` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${companyName} logo`}
                className="h-12 w-auto object-contain sm:h-14"
              />
            ) : (
              <span className="text-xl font-bold sm:text-2xl" style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}>
                {companyName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {accountId && (
              <a
                href={`/site/${accountId}/careers`}
                className="hidden text-base font-medium transition-opacity hover:opacity-100 sm:block"
                style={{ color: themeTextColor, opacity: 0.75 }}
              >
                Careers
              </a>
            )}
            <button
              onClick={() => scrollTo("services")}
              className="hidden text-base font-medium transition-opacity hover:opacity-100 sm:block"
              style={{ color: themeTextColor, opacity: 0.75 }}
            >
              Services
            </button>
            <button
              onClick={() => scrollTo("about")}
              className="hidden text-base font-medium transition-opacity hover:opacity-100 sm:block"
              style={{ color: themeTextColor, opacity: 0.75 }}
            >
              About
            </button>
            <button
              onClick={() => scrollTo("contact")}
              className="rounded-full px-5 py-2 text-base font-semibold transition-opacity hover:opacity-90"
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
          background: heroImageUrl
            ? `linear-gradient(135deg, ${heroDarkStart} 0%, ${heroDarkEnd} 100%), url("${heroImageUrl}")`
            : `linear-gradient(135deg, ${heroSolidStart} 0%, ${heroSolidEnd} 100%)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="relative mx-auto max-w-4xl px-6 text-center" data-site-reveal>
          <h1
            className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl"
            style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}
          >
            {renderHighlightedText(headline)}
          </h1>
          <p
            className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl"
            style={{ color: themeTextColor, opacity: 0.8 }}
          >
            {renderHighlightedText(subheadline)}
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

      {/* About */}
      <section id="about" className="py-20" data-site-reveal>
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2 lg:items-center">
          <div>
            {hasBeforeAfterImages ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="relative overflow-hidden rounded-xl">
                  <div className="relative aspect-[4/3] w-full">
                    <img
                      src={aboutBeforeImageUrl}
                      alt="Before"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${aboutSliderPosition}%` }}
                    >
                      <img
                        src={aboutAfterImageUrl}
                        alt="After"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div
                      className="absolute inset-y-0 w-1 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]"
                      style={{
                        left: `${aboutSliderPosition}%`,
                        transform: "translateX(-50%)",
                        backgroundColor: themeHighlightColor,
                      }}
                    />
                    <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      Before
                    </div>
                    <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      After
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="about-before-after-slider" className="sr-only">
                    Before and after slider
                  </label>
                  <input
                    id="about-before-after-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={aboutSliderPosition}
                    onChange={(e) => setAboutSliderPosition(Number(e.target.value))}
                    className="h-2 w-full cursor-ew-resize"
                    style={{ accentColor: themeHighlightColor }}
                    aria-label="Before and after slider"
                  />
                </div>
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 text-center text-sm text-gray-500">
                Upload both before and after images in Website settings to enable the slider.
              </div>
            )}
          </div>

          <div className="text-left">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl" style={fontCss ? { fontFamily: fontCss } : {}}>
              {renderHighlightedText(aboutHeading)}
            </h2>
            {aboutSubheading && (
              <p className="mt-3 text-base text-gray-500">
                {renderHighlightedText(aboutSubheading)}
              </p>
            )}
            <p className="mt-6 text-lg leading-relaxed text-gray-600">{renderHighlightedText(aboutText)}</p>
          </div>
        </div>
      </section>

      {/* Services */}
      {services.length > 0 && (
        <section id="services" className="bg-gray-50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl" style={fontCss ? { fontFamily: fontCss } : {}}>{renderHighlightedText(servicesHeader)}</h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-600">{renderHighlightedText(servicesSubheading)}</p>
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
                    data-site-reveal
                    className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-md"
                    style={{
                      backgroundColor: themeColor,
                      borderColor: `rgba(${hexToRgb(themeTextColor)}, 0.2)`,
                      color: themeTextColor,
                    } as React.CSSProperties}
                  >
                    {service.image_url ? (
                      <img
                        src={service.image_url}
                        alt={`${service.name} image`}
                        className="aspect-square w-full object-cover"
                      />
                    ) : null}
                    <div className="p-6">
                      {!service.image_url && (
                        <div
                          className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `rgba(${hexToRgb(themeTextColor)}, 0.15)` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: themeTextColor }} />
                        </div>
                      )}
                      <h3 className="text-xl font-semibold uppercase" style={{ color: themeTextColor, ...(fontCss ? { fontFamily: fontCss } : {}) }}>{service.name}</h3>
                      {service.description && (
                        <p className="mt-2 text-base leading-relaxed" style={{ color: `rgba(${hexToRgb(themeTextColor)}, 0.88)` }}>
                          {renderHighlightedText(service.description)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Estimate Calculator */}
      {config.calculator_enabled && services.some((s) => Number.isFinite(Number(s.price_per_unit))) && (() => {
        const calcServices = services.filter((s) => Number.isFinite(Number(s.price_per_unit)));
        const selected = calcServices.find((s) => s.name === calcService) ?? calcServices[0];
        const qty = parseFloat(calcQty);
        const hasQty = !isNaN(qty) && qty > 0;
        const selectedPricePerUnit = selected ? Number(selected.price_per_unit) : NaN;
        const base = hasQty && Number.isFinite(selectedPricePerUnit) ? selectedPricePerUnit * qty : null;
        const low = base ? base * 0.85 : null;
        const high = base ? base * 1.15 : null;
        const fmt = (n: number) =>
          n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
        return (
          <section id="estimate" className="bg-gray-50 py-20" data-site-reveal>
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

      {/* Testimonials */}
      <section className="bg-white py-20" data-site-reveal>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl" style={fontCss ? { fontFamily: fontCss } : {}}>
              {renderHighlightedText(testimonialsHeader)}
            </h2>
            <p className="mt-3 text-gray-500">{renderHighlightedText(testimonialsSubheading)}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <article
                key={testimonial.id || `${testimonial.author}-${testimonial.location}-${index}`}
                data-site-reveal
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                style={{ "--site-reveal-delay": `${Math.min(index * 70, 210)}ms` } as React.CSSProperties}
              >
                <div className="mb-5 flex items-end gap-3">
                  {testimonial.photo_url ? (
                    <img
                      src={testimonial.photo_url}
                      alt={testimonial.author ? `${testimonial.author} headshot` : "Customer headshot"}
                      className="h-20 w-20 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 text-lg font-bold"
                      style={{ color: themeColor, backgroundColor: `rgba(${rgb}, 0.1)` }}
                    >
                      {getTestimonialInitials(testimonial.author || "Customer")}
                    </div>
                  )}
                  <div className="pb-0.5">
                    <p className="text-sm font-bold text-gray-900">{testimonial.author}</p>
                    <p className="text-xs text-gray-500">{testimonial.location}</p>
                    <div className="mt-2 pt-1 flex items-center gap-1">
                      {[...Array(5)].map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" style={{ color: themeHighlightColor }} />
                      ))}
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900" style={fontCss ? { fontFamily: fontCss } : {}}>
                  "{renderHighlightedText(testimonial.heading)}"
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">"{renderHighlightedText(testimonial.quote)}"</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Contact — two-column: info left, form right */}
      <section id="contact" className="py-20" data-site-reveal style={{ backgroundColor: `rgba(${rgb}, 0.05)` }}>
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
                        Phone <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={formPhone}
                        onChange={(e) => setFormPhone(formatPhoneInput(e.target.value))}
                        placeholder="(555) 000-0000"
                        className={inputClass}
                        style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      pattern={EMAIL_PATTERN}
                      placeholder="jane@example.com"
                      className={inputClass}
                      style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      SMS Consent <span className="text-red-400">*</span>
                    </label>
                    <label className="flex items-start gap-3 text-sm text-gray-500">
                      <input
                        type="checkbox"
                        required
                        checked={formSmsConsent}
                        onChange={(e) => setFormSmsConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-2"
                        style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                      />
                      <span>
                        I agree to receive text messages regarding my request, project updates, scheduling, and related services.
                      </span>
                    </label>
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
