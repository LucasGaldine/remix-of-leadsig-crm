import { useState, useEffect } from "react";
import {
  Globe,
  Eye,
  Pencil,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  Wrench,
  Hammer,
  Leaf,
  Droplets,
  Home,
  Zap,
  Paintbrush,
  Truck,
  Shield,
  Scissors,
  Sparkles,
  Star,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export const UNIT_OPTIONS = [
  { value: "sq_ft",     label: "Square Feet (sq ft)" },
  { value: "linear_ft", label: "Linear Feet (lin ft)" },
  { value: "each",      label: "Per Unit (each)" },
  { value: "hour",      label: "Per Hour" },
  { value: "room",      label: "Per Room" },
];

export const FONT_OPTIONS: { name: string; css: string; googleParam: string }[] = [
  { name: "Oswald",         css: "'Oswald', sans-serif",         googleParam: "Oswald:wght@400;600;700" },
  { name: "Bebas Neue",     css: "'Bebas Neue', sans-serif",     googleParam: "Bebas+Neue" },
  { name: "Rajdhani",       css: "'Rajdhani', sans-serif",       googleParam: "Rajdhani:wght@400;600;700" },
  { name: "Archivo Narrow", css: "'Archivo Narrow', sans-serif", googleParam: "Archivo+Narrow:wght@400;600;700" },
  { name: "Libre Franklin", css: "'Libre Franklin', sans-serif", googleParam: "Libre+Franklin:wght@400;600;700" },
  { name: "Cinzel",         css: "'Cinzel', serif",              googleParam: "Cinzel:wght@400;600;700" },
  { name: "Merriweather",   css: "'Merriweather', serif",        googleParam: "Merriweather:wght@400;700" },
  { name: "Lora",           css: "'Lora', serif",                googleParam: "Lora:ital,wght@0,400;0,600;0,700" },
];

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "CheckCircle2", icon: CheckCircle2 },
  { name: "Wrench", icon: Wrench },
  { name: "Hammer", icon: Hammer },
  { name: "Leaf", icon: Leaf },
  { name: "Droplets", icon: Droplets },
  { name: "Home", icon: Home },
  { name: "Zap", icon: Zap },
  { name: "Paintbrush", icon: Paintbrush },
  { name: "Truck", icon: Truck },
  { name: "Shield", icon: Shield },
  { name: "Scissors", icon: Scissors },
  { name: "Sparkles", icon: Sparkles },
  { name: "Star", icon: Star },
];
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { formatServiceTypeOption } from "@/hooks/useServiceTypeOptions";
import { LandingPageView } from "@/components/website/LandingPageView";
import {
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";
import { toast } from "sonner";

export default function Website() {
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const { websiteConfig, isLoading, updateWebsiteAsync, isSaving } = useWebsiteSettings();
  const [pricingRuleServices, setPricingRuleServices] = useState<Array<{
    service_type: string;
    display_name: string;
    unit_type: string;
    price_per_unit: number;
  }>>([]);

  const [published, setPublished] = useState(false);
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [font, setFont] = useState<string>("");
  const [bodyFont, setBodyFont] = useState<string>("");
  const [calculatorEnabled, setCalculatorEnabled] = useState(false);
  // keyed by service type name → description / icon
  const [serviceDescriptions, setServiceDescriptions] = useState<Record<string, string>>({});
  const [serviceIcons, setServiceIcons] = useState<Record<string, string>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const themeColor = normalizeClientPortalColor(currentAccount?.settings?.client_portal_color);
  const themeTextColor = normalizeClientPortalTextColor(currentAccount?.settings?.client_portal_text_color);

  useEffect(() => {
    if (!isLoading && websiteConfig) {
      setPublished(websiteConfig.published ?? false);
      setFont(websiteConfig.font || "");
      setBodyFont(websiteConfig.body_font || "");
      setCalculatorEnabled(websiteConfig.calculator_enabled ?? false);

      setHeadline(websiteConfig.hero?.headline || "");
      setSubheadline(websiteConfig.hero?.subheadline || "");
      setCtaText(websiteConfig.hero?.cta_text || "");
      setAboutText(websiteConfig.about?.text || "");

      // Restore saved descriptions and icons by matching stored service names
      const savedDesc: Record<string, string> = {};
      const savedIcons: Record<string, string> = {};
      for (const s of websiteConfig.services ?? []) {
        savedDesc[s.name] = s.description;
        if (s.icon) savedIcons[s.name] = s.icon;
      }
      setServiceDescriptions(savedDesc);
      setServiceIcons(savedIcons);
      setIsDirty(false);
    }
  }, [isLoading, websiteConfig]);

  useEffect(() => {
    if (!currentAccount?.id) return;
    supabase
      .from("pricing_rules")
      .select("service_type, base_labor_rate, material_rate, waste_factor, overhead_multiplier, profit_margin, unit_type")
      .eq("account_id", currentAccount.id)
      .then(({ data }) => {
        if (!data) {
          setPricingRuleServices([]);
          return;
        }

        const next = data.map((rule) => {
          const serviceType = String(rule.service_type || "").trim();
          const computedRate =
            (Number(rule.base_labor_rate) + Number(rule.material_rate)) *
            (1 + Number(rule.waste_factor) / 100) *
            Number(rule.overhead_multiplier) *
            (1 + Number(rule.profit_margin) / 100);
          return {
            service_type: serviceType,
            display_name: formatServiceTypeOption(serviceType),
            unit_type: String(rule.unit_type || "sq_ft"),
            price_per_unit: Number(computedRate.toFixed(2)),
          };
        }).filter((service) => service.service_type.length > 0);

        setPricingRuleServices(next);
      });
  }, [currentAccount?.id]);

  // Load all Google Fonts for the picker preview
  useEffect(() => {
    const params = FONT_OPTIONS.map((f) => `family=${f.googleParam}`).join("&");
    const id = "website-picker-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${params}&display=swap`;
    document.head.appendChild(link);
  }, []);

  const siteUrl = currentAccount
    ? `${window.location.origin}/site/${currentAccount.id}`
    : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopiedLink(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const builtServices = pricingRuleServices
    .filter((service) => service.display_name !== "Other")
    .map((service) => ({
      id: service.service_type,
      name: service.display_name,
      description: serviceDescriptions[service.display_name] || "",
      icon: serviceIcons[service.display_name] || "CheckCircle2",
      price_per_unit: service.price_per_unit,
      unit_type: service.unit_type,
    }));

  const handleSave = async () => {
    await updateWebsiteAsync({
      published,
      font: font || undefined,
      body_font: bodyFont || undefined,
      calculator_enabled: calculatorEnabled,
      hero: { headline, subheadline, cta_text: ctaText },
      about: { text: aboutText },
      services: builtServices,
    });
    setIsDirty(false);
  };

  const markDirty = () => setIsDirty(true);

  const liveConfig = {
    published,
    font: font || undefined,
    body_font: bodyFont || undefined,
    calculator_enabled: calculatorEnabled,
    hero: { headline, subheadline, cta_text: ctaText },
    about: { text: aboutText },
    services: builtServices,
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayedServices = pricingRuleServices
    .map((service) => service.display_name)
    .filter((name) => name !== "Other");

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Website" />

      <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-6 space-y-4">
        {/* Status bar */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setPublished((p) => !p); markDirty(); }}
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  {published ? (
                    <ToggleRight className="h-7 w-7 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  )}
                  <span className={published ? "text-green-700" : "text-muted-foreground"}>
                    {published ? "Published" : "Unpublished"}
                  </span>
                </button>
                {published && (
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-xs">
                    Live
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {published && siteUrl && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
                      {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Copy Link
                    </Button>
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        View Site
                      </a>
                    </Button>
                  </>
                )}
                <Button onClick={handleSave} disabled={isSaving || !isDirty} size="sm" className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

            {published && siteUrl && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="truncate text-xs text-muted-foreground">{siteUrl}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="edit">
          <TabsList className="w-full">
            <TabsTrigger value="edit" className="flex-1 gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1 gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* ── EDIT TAB ── */}
          <TabsContent value="edit" className="mt-4 space-y-4">
            {/* Typography */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Typography</CardTitle>
                <CardDescription>Choose fonts for headings and body text</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Heading font */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Heading font</p>
                    {font && (
                      <button
                        type="button"
                        onClick={() => { setFont(""); markDirty(); }}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {FONT_OPTIONS.map((f) => {
                      const selected = font === f.name;
                      return (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() => { setFont(f.name); markDirty(); }}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-4 text-center transition-colors ${
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-muted/30 hover:border-primary/40"
                          }`}
                        >
                          <span className="text-2xl font-bold leading-none text-foreground" style={{ fontFamily: f.css }}>
                            Aa
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-tight">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Body font */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Body &amp; button font</p>
                    {bodyFont && (
                      <button
                        type="button"
                        onClick={() => { setBodyFont(""); markDirty(); }}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {FONT_OPTIONS.map((f) => {
                      const selected = bodyFont === f.name;
                      return (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() => { setBodyFont(f.name); markDirty(); }}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-4 text-center transition-colors ${
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-muted/30 hover:border-primary/40"
                          }`}
                        >
                          <span className="text-sm font-medium leading-snug text-foreground" style={{ fontFamily: f.css }}>
                            The quick<br />brown fox
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-tight">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hero */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hero Section</CardTitle>
                <CardDescription>The first thing visitors see</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={headline}
                    onChange={(e) => { setHeadline(e.target.value); markDirty(); }}
                    placeholder={`Professional Services by ${currentAccount?.company_name || "Your Company"}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subheadline">Tagline</Label>
                  <Input
                    id="subheadline"
                    value={subheadline}
                    onChange={(e) => { setSubheadline(e.target.value); markDirty(); }}
                    placeholder="Quality work, reliable service, and results you can count on."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cta-text">Call-to-Action Button Text</Label>
                  <Input
                    id="cta-text"
                    value={ctaText}
                    onChange={(e) => { setCtaText(e.target.value); markDirty(); }}
                    placeholder="Get a Free Quote"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Services</CardTitle>
                    <CardDescription className="mt-1">
                      Pulled from your{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/settings/pricing-rules")}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Pricing Rules
                      </button>
                      . Add an optional description for each.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/settings/pricing-rules")}
                    className="gap-1.5 shrink-0 text-muted-foreground"
                  >
                    Manage
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {displayedServices.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No pricing rules set up yet.
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => navigate("/settings/pricing-rules")}
                      className="mt-1 gap-1"
                    >
                      Add services in Pricing Rules
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedServices.map((name) => (
                      <div
                        key={name}
                        className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                      >
                        <p className="text-sm font-semibold">{name}</p>
                        {/* Icon picker */}
                        <div className="flex flex-wrap gap-1.5">
                          {ICON_OPTIONS.map(({ name: iconName, icon: IconComp }) => {
                            const selected = (serviceIcons[name] || "CheckCircle2") === iconName;
                            return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => {
                                  setServiceIcons((prev) => ({ ...prev, [name]: iconName }));
                                  markDirty();
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                                  selected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                }`}
                                title={iconName}
                              >
                                <IconComp className="h-4 w-4" />
                              </button>
                            );
                          })}
                        </div>
                        <Textarea
                          value={serviceDescriptions[name] || ""}
                          onChange={(e) => {
                            setServiceDescriptions((prev) => ({
                              ...prev,
                              [name]: e.target.value,
                            }));
                            markDirty();
                          }}
                          placeholder="Optional description for this service…"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
                <CardDescription>Tell visitors about your business</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={aboutText}
                  onChange={(e) => { setAboutText(e.target.value); markDirty(); }}
                  placeholder={`${currentAccount?.company_name || "We"} are committed to delivering top-quality service. We take pride in our work and treat every job as if it were our own home.`}
                  rows={5}
                />
              </CardContent>
            </Card>

            {/* Estimate Calculator */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Estimate Calculator</CardTitle>
                    <CardDescription className="mt-1">
                      Let visitors calculate a project estimate on your site
                    </CardDescription>
                  </div>
                  <Switch
                    checked={calculatorEnabled}
                    onCheckedChange={(v) => { setCalculatorEnabled(v); markDirty(); }}
                  />
                </div>
              </CardHeader>
              {calculatorEnabled && (
                <CardContent>
                  {displayedServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add services in Pricing Rules first.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Calculator rates and units are pulled directly from Pricing Rules.
                      </p>
                      {displayedServices.map((name) => (
                        <div
                          key={name}
                          className="rounded-xl border border-border bg-muted/30 p-4"
                        >
                          <p className="text-sm font-semibold">{name}</p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {(() => {
                              const service = pricingRuleServices.find((entry) => entry.display_name === name);
                              if (!service) return "No rate configured";
                              const unitLabel = UNIT_OPTIONS.find((opt) => opt.value === service.unit_type)?.label ?? service.unit_type;
                              return `$${service.price_per_unit.toFixed(2)} per ${unitLabel}`;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Contact (read-only) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Info</CardTitle>
                <CardDescription>
                  Pulled from your{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/settings/company")}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Company Profile
                  </button>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentAccount?.company_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Phone:</span>
                    {currentAccount.company_phone}
                  </div>
                )}
                {currentAccount?.company_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Email:</span>
                    {currentAccount.company_email}
                  </div>
                )}
                {currentAccount?.company_address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Address:</span>
                    {currentAccount.company_address}
                  </div>
                )}
                {!currentAccount?.company_phone &&
                  !currentAccount?.company_email &&
                  !currentAccount?.company_address && (
                    <p className="text-sm text-muted-foreground">
                      No contact info set.{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/settings/company")}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Add it in Company Profile →
                      </button>
                    </p>
                  )}
              </CardContent>
            </Card>

            <div className="flex justify-end pb-4">
              <Button onClick={handleSave} disabled={isSaving || !isDirty} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          {/* ── PREVIEW TAB ── */}
          <TabsContent value="preview" className="mt-4">
            <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 rounded-md bg-background px-3 py-1 text-center text-xs text-muted-foreground truncate">
                  {siteUrl || "yoursite.leadsig.ai"}
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                <LandingPageView
                  config={liveConfig}
                  themeColor={themeColor}
                  themeTextColor={themeTextColor}
                  companyName={currentAccount?.company_name || "Your Company"}
                  companyPhone={currentAccount?.company_phone}
                  companyEmail={currentAccount?.company_email}
                  companyAddress={currentAccount?.company_address}
                  logoUrl={currentAccount?.logo_url}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <MobileNav />
    </div>
  );
}
