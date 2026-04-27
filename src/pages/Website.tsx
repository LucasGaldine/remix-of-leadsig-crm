import { useState, useEffect, type CSSProperties } from "react";
import {
  Globe,
  Eye,
  Pencil,
  BarChart3,
  TrendingUp,
  Users,
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
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FONT_OPTIONS, getBrandFontOption } from "@/lib/brandFonts";

export const UNIT_OPTIONS = [
  { value: "sq_ft",     label: "Square Feet (sq ft)" },
  { value: "linear_ft", label: "Linear Feet (lin ft)" },
  { value: "each",      label: "Per Unit (each)" },
  { value: "hour",      label: "Per Hour" },
  { value: "room",      label: "Per Room" },
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
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useWebsiteSettings, type WebsiteTestimonial } from "@/hooks/useWebsiteSettings";
import { formatServiceTypeOption } from "@/hooks/useServiceTypeOptions";
import { LandingPageView } from "@/components/website/LandingPageView";
import { ClientPortalHeader } from "@/components/client-portal/ClientPortalHeader";
import {
  darkenHexColor,
  hexToRgba,
  normalizeClientPortalColor,
  normalizeClientPortalHighlightColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";
import { toast } from "sonner";
import {
  getWebsiteAboutImageStoragePath,
  getWebsiteHeroImageStoragePath,
  getWebsiteServiceImageStoragePath,
  getWebsiteTestimonialImageStoragePath,
  getWebsiteHeroImageValidationError,
} from "@/lib/websiteHeroImage";
import { buildWebsitePublicUrl } from "@/lib/websiteUrl";

const DOMAIN_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

const DEFAULT_TESTIMONIALS: WebsiteTestimonial[] = [
  {
    id: "testimonial-1",
    heading: "Easy, Transparent Process",
    quote: "The whole process was simple from start to finish. Communication stayed clear the entire time.",
    author: "Sarah M.",
    location: "Homeowner",
    photo_url: null,
  },
  {
    id: "testimonial-2",
    heading: "On Time and Professional",
    quote: "They arrived on time, worked efficiently, and left everything spotless when the job was done.",
    author: "David R.",
    location: "Property Manager",
    photo_url: null,
  },
  {
    id: "testimonial-3",
    heading: "High-Quality Results",
    quote: "Every detail was handled with care. The quality of the finished work exceeded expectations.",
    author: "Priya K.",
    location: "Local Business Owner",
    photo_url: null,
  },
];

function normalizeTestimonials(input?: WebsiteTestimonial[] | null): WebsiteTestimonial[] {
  return DEFAULT_TESTIMONIALS.map((fallback, index) => {
    const existing = input?.[index];
    return {
      id: existing?.id || fallback.id,
      heading: existing?.heading ?? fallback.heading,
      quote: existing?.quote ?? fallback.quote,
      author: existing?.author ?? fallback.author,
      location: existing?.location ?? fallback.location,
      photo_url: existing?.photo_url ?? fallback.photo_url,
    };
  });
}

function normalizeDomainInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

async function uploadProfileStorageObject(
  filePath: string,
  file: File,
  accessToken: string,
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration");
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  const objectPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const uploadUrl = `${baseUrl}/storage/v1/object/profiles/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "x-upsert": "true",
      "cache-control": "3600",
      "content-type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    let errorMessage = `Storage upload failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        errorMessage = `${errorMessage}: ${payload.message}`;
      }
    } catch {
      // Ignore JSON parse errors for empty/non-JSON responses.
    }
    throw new Error(errorMessage);
  }

  return `${baseUrl}/storage/v1/object/public/profiles/${objectPath}`;
}

export default function Website() {
  const navigate = useNavigate();
  const { currentAccount, refreshProfile } = useAuth();
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
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroImagePreviewUrl, setHeroImagePreviewUrl] = useState("");
  const [selectedHeroImageFile, setSelectedHeroImageFile] = useState<File | null>(null);
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);
  const [servicesHeader, setServicesHeader] = useState("");
  const [servicesSubheading, setServicesSubheading] = useState("");
  const [testimonialsHeader, setTestimonialsHeader] = useState("");
  const [testimonialsSubheading, setTestimonialsSubheading] = useState("");
  const [aboutHeading, setAboutHeading] = useState("");
  const [aboutSubheading, setAboutSubheading] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [aboutBeforeImageUrl, setAboutBeforeImageUrl] = useState("");
  const [aboutAfterImageUrl, setAboutAfterImageUrl] = useState("");
  const [aboutBeforeImagePreviewUrl, setAboutBeforeImagePreviewUrl] = useState("");
  const [aboutAfterImagePreviewUrl, setAboutAfterImagePreviewUrl] = useState("");
  const [selectedAboutBeforeImageFile, setSelectedAboutBeforeImageFile] = useState<File | null>(null);
  const [selectedAboutAfterImageFile, setSelectedAboutAfterImageFile] = useState<File | null>(null);
  const [testimonials, setTestimonials] = useState<WebsiteTestimonial[]>(normalizeTestimonials());
  const [testimonialPhotoUrls, setTestimonialPhotoUrls] = useState<Record<string, string>>({});
  const [testimonialPhotoPreviews, setTestimonialPhotoPreviews] = useState<Record<string, string>>({});
  const [selectedTestimonialPhotoFiles, setSelectedTestimonialPhotoFiles] = useState<Record<string, File | null>>({});
  const [font, setFont] = useState<string>("");
  const [bodyFont, setBodyFont] = useState<string>("");
  const [calculatorEnabled, setCalculatorEnabled] = useState(false);
  // keyed by service type name → description / icon
  const [serviceDescriptions, setServiceDescriptions] = useState<Record<string, string>>({});
  const [serviceIcons, setServiceIcons] = useState<Record<string, string>>({});
  const [serviceEnabled, setServiceEnabled] = useState<Record<string, boolean>>({});
  const [serviceImageUrls, setServiceImageUrls] = useState<Record<string, string>>({});
  const [serviceImagePreviews, setServiceImagePreviews] = useState<Record<string, string>>({});
  const [selectedServiceImageFiles, setSelectedServiceImageFiles] = useState<Record<string, File | null>>({});
  const [editingServiceName, setEditingServiceName] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [portalColor, setPortalColor] = useState("");
  const [portalTextColor, setPortalTextColor] = useState("");
  const [portalHighlightColor, setPortalHighlightColor] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [activeTab, setActiveTab] = useState("edit");
  const [previewMode, setPreviewMode] = useState<"website" | "client-portal">("website");

  const normalizedPortalColor = normalizeClientPortalColor(portalColor);
  const normalizedPortalTextColor = normalizeClientPortalTextColor(portalTextColor);
  const normalizedPortalHighlightColor = normalizeClientPortalHighlightColor(portalHighlightColor);

  useEffect(() => {
    if (!isLoading && websiteConfig) {
      setPublished(websiteConfig.published ?? false);
      setFont(websiteConfig.font || "");
      setBodyFont(websiteConfig.body_font || "");
      setCalculatorEnabled(websiteConfig.calculator_enabled ?? false);

      setHeadline(websiteConfig.hero?.headline || "");
      setSubheadline(websiteConfig.hero?.subheadline || "");
      setCtaText(websiteConfig.hero?.cta_text || "");
      const initialHeroImage = websiteConfig.hero?.header_image_url || "";
      setHeroImageUrl(initialHeroImage);
      setHeroImagePreviewUrl(initialHeroImage);
      setSelectedHeroImageFile(null);
      setServicesHeader(websiteConfig.services_section?.header || "");
      setServicesSubheading(websiteConfig.services_section?.subheading || "");
      setTestimonialsHeader(websiteConfig.testimonials_section?.header || "");
      setTestimonialsSubheading(websiteConfig.testimonials_section?.subheading || "");
      setAboutHeading(websiteConfig.about?.heading || "");
      setAboutSubheading(websiteConfig.about?.subheading || "");
      setAboutText(websiteConfig.about?.text || "");
      const initialAboutBeforeImage = websiteConfig.about?.before_image_url || "";
      const initialAboutAfterImage = websiteConfig.about?.after_image_url || "";
      setAboutBeforeImageUrl(initialAboutBeforeImage);
      setAboutAfterImageUrl(initialAboutAfterImage);
      setAboutBeforeImagePreviewUrl(initialAboutBeforeImage);
      setAboutAfterImagePreviewUrl(initialAboutAfterImage);
      setSelectedAboutBeforeImageFile(null);
      setSelectedAboutAfterImageFile(null);
      const initialTestimonials = normalizeTestimonials(websiteConfig.testimonials);
      setTestimonials(initialTestimonials);
      const savedTestimonialPhotos: Record<string, string> = {};
      for (const testimonial of initialTestimonials) {
        if (testimonial.photo_url) {
          savedTestimonialPhotos[testimonial.id] = testimonial.photo_url;
        }
      }
      setTestimonialPhotoUrls(savedTestimonialPhotos);
      setTestimonialPhotoPreviews(savedTestimonialPhotos);
      setSelectedTestimonialPhotoFiles({});
      setCustomDomain(websiteConfig.custom_domain || "");

      // Restore saved descriptions and icons by matching stored service names
      const savedDesc: Record<string, string> = {};
      const savedIcons: Record<string, string> = {};
      const savedImages: Record<string, string> = {};
      const savedEnabled: Record<string, boolean> = {};
      for (const s of websiteConfig.services ?? []) {
        savedDesc[s.name] = s.description;
        if (s.icon) savedIcons[s.name] = s.icon;
        if (s.image_url) savedImages[s.name] = s.image_url;
        savedEnabled[s.name] = s.enabled !== false;
      }
      setServiceDescriptions(savedDesc);
      setServiceIcons(savedIcons);
      setServiceEnabled(savedEnabled);
      setServiceImageUrls(savedImages);
      setServiceImagePreviews(savedImages);
      setSelectedServiceImageFiles({});
      setIsDirty(false);
    }
  }, [isLoading, websiteConfig]);

  useEffect(() => {
    setServiceEnabled((prev) => {
      const next: Record<string, boolean> = {};
      for (const service of pricingRuleServices) {
        if (service.display_name === "Other") continue;
        next[service.display_name] = prev[service.display_name] ?? true;
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
  }, [pricingRuleServices]);

  useEffect(() => {
    setPortalColor(normalizeClientPortalColor(currentAccount?.settings?.client_portal_color));
    setPortalTextColor(normalizeClientPortalTextColor(currentAccount?.settings?.client_portal_text_color));
    setPortalHighlightColor(normalizeClientPortalHighlightColor(currentAccount?.settings?.client_portal_highlight_color));
  }, [
    currentAccount?.settings?.client_portal_color,
    currentAccount?.settings?.client_portal_text_color,
    currentAccount?.settings?.client_portal_highlight_color,
  ]);

  useEffect(() => {
    return () => {
      if (heroImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(heroImagePreviewUrl);
      }
    };
  }, [heroImagePreviewUrl]);

  useEffect(() => {
    return () => {
      Object.values(serviceImagePreviews).forEach((previewUrl) => {
        if (previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      });
    };
  }, [serviceImagePreviews]);

  useEffect(() => {
    return () => {
      if (aboutBeforeImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(aboutBeforeImagePreviewUrl);
      }
      if (aboutAfterImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(aboutAfterImagePreviewUrl);
      }
    };
  }, [aboutBeforeImagePreviewUrl, aboutAfterImagePreviewUrl]);

  useEffect(() => {
    return () => {
      Object.values(testimonialPhotoPreviews).forEach((previewUrl) => {
        if (previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      });
    };
  }, [testimonialPhotoPreviews]);

  useEffect(() => {
    if (!currentAccount?.id) return;
    supabase
      .from("pricing_rules")
      .select("service_type, base_labor_rate, material_rate, waste_factor, overhead_multiplier, profit_margin, unit_type, updated_at")
      .eq("account_id", currentAccount.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (!data) {
          setPricingRuleServices([]);
          return;
        }

        const byServiceType = new Map<string, {
          service_type: string;
          display_name: string;
          unit_type: string;
          price_per_unit: number;
        }>();

        for (const rule of data) {
          const serviceType = String(rule.service_type || "").trim();
          const serviceTypeKey = serviceType.toLowerCase();
          if (!serviceType || byServiceType.has(serviceTypeKey)) continue;

          const baseLaborRate = Number(rule.base_labor_rate ?? 0);
          const materialRate = Number(rule.material_rate ?? 0);
          const wasteFactor = Number(rule.waste_factor ?? 0);
          const overheadMultiplier = Number(rule.overhead_multiplier ?? 1);
          const profitMargin = Number(rule.profit_margin ?? 0);
          const computedRate =
            (baseLaborRate + materialRate) *
            (1 + wasteFactor / 100) *
            overheadMultiplier *
            (1 + profitMargin / 100);

          byServiceType.set(serviceTypeKey, {
            service_type: serviceType,
            display_name: formatServiceTypeOption(serviceType),
            unit_type: String(rule.unit_type || "sq_ft"),
            price_per_unit: Number.isFinite(computedRate) ? Number(computedRate.toFixed(2)) : 0,
          });
        }

        setPricingRuleServices(Array.from(byServiceType.values()));
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

  const customDomainNormalized = normalizeDomainInput(customDomain);
  const siteUrl = currentAccount
    ? buildWebsitePublicUrl(currentAccount.id, { customDomain: customDomainNormalized || null })
    : "";
  const hasCustomDomain = customDomainNormalized.length > 0;
  const customDomainValid = !hasCustomDomain || DOMAIN_PATTERN.test(customDomainNormalized);
  const dnsTargetHost = (() => {
    const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
    if (configuredSiteUrl) {
      try {
        return new URL(configuredSiteUrl).hostname;
      } catch {
        return window.location.hostname;
      }
    }
    return window.location.hostname;
  })();
  const apexDomain = customDomainNormalized.replace(/^www\./, "");
  const wwwHost = apexDomain ? `www.${apexDomain}` : "www.yourdomain.com";

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
      image_url: serviceImagePreviews[service.display_name] || serviceImageUrls[service.display_name] || null,
      enabled: serviceEnabled[service.display_name] ?? true,
      price_per_unit: service.price_per_unit,
      unit_type: service.unit_type,
    }));

  const handleServiceImageUpload = (serviceName: string, file?: File | null) => {
    if (!file) return;

    const validationError = getWebsiteHeroImageValidationError(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const previousPreview = serviceImagePreviews[serviceName];
    if (previousPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(previousPreview);
    }

    setSelectedServiceImageFiles((prev) => ({ ...prev, [serviceName]: file }));
    setServiceImagePreviews((prev) => ({ ...prev, [serviceName]: objectUrl }));
    setIsDirty(true);
  };

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = getWebsiteHeroImageValidationError(file);
    if (validationError) {
      toast.error(validationError);
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (heroImagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(heroImagePreviewUrl);
    }

    setSelectedHeroImageFile(file);
    setHeroImagePreviewUrl(objectUrl);
    setIsDirty(true);
    toast.success("Hero image ready to save");
    e.target.value = "";
  };

  const handleAboutImageUpload = (variant: "before" | "after", file?: File | null) => {
    if (!file) return;

    const validationError = getWebsiteHeroImageValidationError(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const currentPreview =
      variant === "before" ? aboutBeforeImagePreviewUrl : aboutAfterImagePreviewUrl;
    if (currentPreview.startsWith("blob:")) {
      URL.revokeObjectURL(currentPreview);
    }

    if (variant === "before") {
      setSelectedAboutBeforeImageFile(file);
      setAboutBeforeImagePreviewUrl(objectUrl);
    } else {
      setSelectedAboutAfterImageFile(file);
      setAboutAfterImagePreviewUrl(objectUrl);
    }

    setIsDirty(true);
    toast.success(`${variant === "before" ? "Before" : "After"} image ready to save`);
  };

  const updateTestimonialField = (
    testimonialId: string,
    field: "heading" | "quote" | "author" | "location",
    value: string,
  ) => {
    setTestimonials((prev) =>
      prev.map((testimonial) =>
        testimonial.id === testimonialId ? { ...testimonial, [field]: value } : testimonial,
      ),
    );
    markDirty();
  };

  const handleTestimonialPhotoUpload = (testimonialId: string, file?: File | null) => {
    if (!file) return;

    const validationError = getWebsiteHeroImageValidationError(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const previousPreview = testimonialPhotoPreviews[testimonialId];
    if (previousPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(previousPreview);
    }

    setSelectedTestimonialPhotoFiles((prev) => ({ ...prev, [testimonialId]: file }));
    setTestimonialPhotoPreviews((prev) => ({ ...prev, [testimonialId]: objectUrl }));
    setTestimonials((prev) =>
      prev.map((testimonial) =>
        testimonial.id === testimonialId ? { ...testimonial, photo_url: objectUrl } : testimonial,
      ),
    );
    setIsDirty(true);
    toast.success("Customer photo ready to save");
  };

  const handleSave = async () => {
    if (!currentAccount?.id) return;
    if (!customDomainValid) {
      toast.error("Enter a valid custom domain");
      return;
    }

    try {
      const {
        data: { session: existingSession },
        error: getSessionError,
      } = await supabase.auth.getSession();
      if (getSessionError) throw getSessionError;

      if (!existingSession?.access_token) {
        const {
          data: refreshData,
          error: refreshSessionError,
        } = await supabase.auth.refreshSession();
        if (refreshSessionError || !refreshData.session?.access_token) {
          throw refreshSessionError ?? new Error("Session expired. Please sign in again.");
        }
      }
      const {
        data: { session: activeSession },
        error: activeSessionError,
      } = await supabase.auth.getSession();
      if (activeSessionError || !activeSession?.access_token) {
        throw activeSessionError ?? new Error("Session expired. Please sign in again.");
      }

      let uploadedHeroImageUrl = heroImageUrl || null;
      let uploadedAboutBeforeImageUrl = aboutBeforeImageUrl || null;
      let uploadedAboutAfterImageUrl = aboutAfterImageUrl || null;
      const uploadedTestimonialPhotoUrls = { ...testimonialPhotoUrls };

      if (selectedHeroImageFile && currentAccount?.id) {
        setIsUploadingHeroImage(true);
        const fileExt = selectedHeroImageFile.name.split(".").pop() || "jpg";
        const filePath = getWebsiteHeroImageStoragePath(currentAccount.id, Date.now(), fileExt);

        uploadedHeroImageUrl = await uploadProfileStorageObject(
          filePath,
          selectedHeroImageFile,
          activeSession.access_token,
        );
      }

      if (selectedAboutBeforeImageFile && currentAccount?.id) {
        const fileExt = selectedAboutBeforeImageFile.name.split(".").pop() || "jpg";
        const filePath = getWebsiteAboutImageStoragePath(currentAccount.id, "before", Date.now(), fileExt);
        uploadedAboutBeforeImageUrl = await uploadProfileStorageObject(
          filePath,
          selectedAboutBeforeImageFile,
          activeSession.access_token,
        );
      }

      if (selectedAboutAfterImageFile && currentAccount?.id) {
        const fileExt = selectedAboutAfterImageFile.name.split(".").pop() || "jpg";
        const filePath = getWebsiteAboutImageStoragePath(currentAccount.id, "after", Date.now(), fileExt);
        uploadedAboutAfterImageUrl = await uploadProfileStorageObject(
          filePath,
          selectedAboutAfterImageFile,
          activeSession.access_token,
        );
      }

      const uploadedServiceImageUrls = { ...serviceImageUrls };
      if (currentAccount?.id) {
        for (const [serviceName, serviceImageFile] of Object.entries(selectedServiceImageFiles)) {
          if (!serviceImageFile) continue;

          const fileExt = serviceImageFile.name.split(".").pop() || "jpg";
          const filePath = getWebsiteServiceImageStoragePath(
            currentAccount.id,
            serviceName,
            Date.now(),
            fileExt,
          );

          uploadedServiceImageUrls[serviceName] = await uploadProfileStorageObject(
            filePath,
            serviceImageFile,
            activeSession.access_token,
          );
        }
      }

      if (currentAccount?.id) {
        for (const [testimonialId, testimonialImageFile] of Object.entries(selectedTestimonialPhotoFiles)) {
          if (!testimonialImageFile) continue;

          const fileExt = testimonialImageFile.name.split(".").pop() || "jpg";
          const filePath = getWebsiteTestimonialImageStoragePath(
            currentAccount.id,
            testimonialId,
            Date.now(),
            fileExt,
          );

          uploadedTestimonialPhotoUrls[testimonialId] = await uploadProfileStorageObject(
            filePath,
            testimonialImageFile,
            activeSession.access_token,
          );
        }
      }

      const servicesForSave = pricingRuleServices
        .filter((service) => service.display_name !== "Other")
        .map((service) => ({
          id: service.service_type,
          name: service.display_name,
          description: serviceDescriptions[service.display_name] || "",
          icon: serviceIcons[service.display_name] || "CheckCircle2",
          image_url: uploadedServiceImageUrls[service.display_name] || null,
          enabled: serviceEnabled[service.display_name] ?? true,
          price_per_unit: service.price_per_unit,
          unit_type: service.unit_type,
        }));

      const testimonialsForSave = testimonials.map((testimonial) => ({
        ...testimonial,
        photo_url: uploadedTestimonialPhotoUrls[testimonial.id] || null,
      }));

      await updateWebsiteAsync({
        published,
        custom_domain: customDomainNormalized || undefined,
        font: font || undefined,
        body_font: bodyFont || undefined,
        calculator_enabled: calculatorEnabled,
        hero: {
          headline,
          subheadline,
          cta_text: ctaText,
          header_image_url: uploadedHeroImageUrl,
        },
        services_section: {
          header: servicesHeader,
          subheading: servicesSubheading,
        },
        testimonials_section: {
          header: testimonialsHeader,
          subheading: testimonialsSubheading,
        },
        about: {
          heading: aboutHeading,
          subheading: aboutSubheading,
          text: aboutText,
          before_image_url: uploadedAboutBeforeImageUrl,
          after_image_url: uploadedAboutAfterImageUrl,
        },
        services: servicesForSave,
        testimonials: testimonialsForSave,
      });

      const { data: accountData, error: loadAccountError } = await supabase
        .from("accounts")
        .select("settings")
        .eq("id", currentAccount.id)
        .single();

      if (loadAccountError) throw loadAccountError;

      const existingSettings = (accountData?.settings as Record<string, unknown>) ?? {};
      const { error: updateAccountError } = await supabase
        .from("accounts")
        .update({
          settings: {
            ...existingSettings,
            client_portal_color: normalizeClientPortalColor(portalColor),
            client_portal_text_color: normalizeClientPortalTextColor(portalTextColor),
            client_portal_highlight_color: normalizeClientPortalHighlightColor(portalHighlightColor),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentAccount.id);

      if (updateAccountError) throw updateAccountError;

      setPortalColor(normalizeClientPortalColor(portalColor));
      setPortalTextColor(normalizeClientPortalTextColor(portalTextColor));
      setPortalHighlightColor(normalizeClientPortalHighlightColor(portalHighlightColor));
      setHeroImageUrl(uploadedHeroImageUrl || "");
      setHeroImagePreviewUrl(uploadedHeroImageUrl || "");
      setSelectedHeroImageFile(null);
      setAboutBeforeImageUrl(uploadedAboutBeforeImageUrl || "");
      setAboutAfterImageUrl(uploadedAboutAfterImageUrl || "");
      setAboutBeforeImagePreviewUrl(uploadedAboutBeforeImageUrl || "");
      setAboutAfterImagePreviewUrl(uploadedAboutAfterImageUrl || "");
      setSelectedAboutBeforeImageFile(null);
      setSelectedAboutAfterImageFile(null);
      setServiceImageUrls(uploadedServiceImageUrls);
      setServiceImagePreviews(uploadedServiceImageUrls);
      setSelectedServiceImageFiles({});
      setTestimonials(testimonialsForSave);
      setTestimonialPhotoUrls(uploadedTestimonialPhotoUrls);
      setTestimonialPhotoPreviews(uploadedTestimonialPhotoUrls);
      setSelectedTestimonialPhotoFiles({});
      setIsDirty(false);
      await refreshProfile();
    } catch (error) {
      const {
        data: { user: activeUser },
      } = await supabase.auth.getUser();
      console.error("Error saving website settings:", {
        error,
        activeUserId: activeUser?.id ?? null,
        currentAccountId: currentAccount?.id ?? null,
      });
      toast.error("Failed to save website settings");
    } finally {
      setIsUploadingHeroImage(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  const liveConfig = {
    published,
    custom_domain: customDomainNormalized || undefined,
    font: font || undefined,
    body_font: bodyFont || undefined,
    calculator_enabled: calculatorEnabled,
    hero: {
      headline,
      subheadline,
      cta_text: ctaText,
      header_image_url: heroImagePreviewUrl || heroImageUrl || null,
    },
    services_section: {
      header: servicesHeader,
      subheading: servicesSubheading,
    },
    testimonials_section: {
      header: testimonialsHeader,
      subheading: testimonialsSubheading,
    },
    about: {
      heading: aboutHeading,
      subheading: aboutSubheading,
      text: aboutText,
      before_image_url: aboutBeforeImagePreviewUrl || aboutBeforeImageUrl || null,
      after_image_url: aboutAfterImagePreviewUrl || aboutAfterImageUrl || null,
    },
    services: builtServices,
    testimonials: testimonials.map((testimonial) => ({
      ...testimonial,
      photo_url:
        testimonialPhotoPreviews[testimonial.id] ||
        testimonialPhotoUrls[testimonial.id] ||
        null,
    })),
  };

  const { data: trafficAnalytics, isLoading: trafficLoading } = useQuery({
    queryKey: ["website-traffic-analytics", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount?.id) {
        return {
          totalLeads: 0,
          leadsLast30Days: 0,
          approvedLeads: 0,
          conversionRate: 0,
          weeklyCounts: [] as Array<{ label: string; count: number }>,
        };
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixWeeksAgo = new Date();
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 41);

      const { data, error } = await supabase
        .from("leads")
        .select("created_at, approval_status")
        .eq("account_id", currentAccount.id)
        .eq("source", "website")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = data ?? [];
      const totalLeads = rows.length;
      const approvedLeads = rows.filter((row: any) => row.approval_status === "approved").length;
      const leadsLast30Days = rows.filter((row: any) => new Date(row.created_at) >= thirtyDaysAgo).length;
      const conversionRate = totalLeads > 0 ? Math.round((approvedLeads / totalLeads) * 100) : 0;

      const weekBuckets: Array<{ start: Date; end: Date; label: string; count: number }> = [];
      const start = new Date(sixWeeksAgo);
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < 6; i++) {
        const bucketStart = new Date(start);
        bucketStart.setDate(start.getDate() + i * 7);
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketStart.getDate() + 7);
        weekBuckets.push({
          start: bucketStart,
          end: bucketEnd,
          label: `${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`,
          count: 0,
        });
      }

      rows.forEach((row: any) => {
        const createdAt = new Date(row.created_at);
        for (const bucket of weekBuckets) {
          if (createdAt >= bucket.start && createdAt < bucket.end) {
            bucket.count += 1;
            break;
          }
        }
      });

      return {
        totalLeads,
        leadsLast30Days,
        approvedLeads,
        conversionRate,
        weeklyCounts: weekBuckets.map(({ label, count }) => ({ label, count })),
      };
    },
    enabled: !!currentAccount?.id,
  });

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
  const visibleServices = displayedServices.filter((name) => serviceEnabled[name] ?? true);
  const editingService = editingServiceName
    ? pricingRuleServices.find((service) => service.display_name === editingServiceName) ?? null
    : null;
  const previewJob = {
    name: "Spring Cleanup",
    address: "123 Main St",
    service_type: "Lawn Care",
    customer: { name: "Sarah" },
  };
  const previewCompany = {
    company_name: currentAccount?.company_name || "Your Company",
    logo_url: currentAccount?.logo_url || undefined,
  };
  const previewEstimate = { total: 350 };
  const previewPortalColorDark = darkenHexColor(normalizedPortalColor, 0.16);
  const previewHeadingFontOption = getBrandFontOption(font);
  const previewBodyFontOption = getBrandFontOption(bodyFont);
  const previewPortalThemeStyle = {
    "--client-portal-color": normalizedPortalColor,
    "--client-portal-color-dark": previewPortalColorDark,
    "--client-portal-text-color": normalizedPortalTextColor,
    "--client-portal-text-muted": hexToRgba(normalizedPortalTextColor, 0.72),
    "--client-portal-text-subtle": hexToRgba(normalizedPortalTextColor, 0.56),
    "--client-portal-heading-font": previewHeadingFontOption?.css,
    "--client-portal-body-font": previewBodyFontOption?.css,
  } as CSSProperties;

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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="traffic" className="flex-1 gap-2">
              <BarChart3 className="h-4 w-4" />
              Traffic
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex-1 gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1 gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="traffic" className="mt-4 space-y-4">
            {trafficLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading site analytics...
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Website Leads</p>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold">{trafficAnalytics?.totalLeads ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Last 30 Days</p>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold">{trafficAnalytics?.leadsLast30Days ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Approved Leads</p>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold">{trafficAnalytics?.approvedLeads ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Conversion Rate</p>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold">{trafficAnalytics?.conversionRate ?? 0}%</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Lead Trend (Last 6 Weeks)</CardTitle>
                    <CardDescription>Website submissions grouped by week.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trafficAnalytics?.weeklyCounts?.length ? (
                      <div className="space-y-3">
                        {trafficAnalytics.weeklyCounts.map((point) => {
                          const maxCount = Math.max(
                            1,
                            ...trafficAnalytics.weeklyCounts.map((week) => week.count),
                          );
                          const widthPct = Math.max(6, Math.round((point.count / maxCount) * 100));
                          return (
                            <div key={point.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{point.label}</span>
                                <span>{point.count}</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-primary"
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No website traffic data yet.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── EDIT TAB ── */}
          <TabsContent value="edit" className="mt-4 space-y-4">
            {/* Custom Domain & DNS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custom Domain & DNS</CardTitle>
                <CardDescription>Connect your domain and point DNS records to your hosted website.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-domain">Custom Domain</Label>
                  <Input
                    id="custom-domain"
                    value={customDomain}
                    onChange={(e) => { setCustomDomain(e.target.value); markDirty(); }}
                    onBlur={() => setCustomDomain(normalizeDomainInput(customDomain))}
                    placeholder="www.yourcompany.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter only the domain (for example: `www.yourcompany.com`).
                  </p>
                  {!customDomainValid && (
                    <p className="text-xs text-red-600">
                      Use a valid domain like `www.yourcompany.com`.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-medium">DNS records to add</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background p-3 text-sm">
                      <p><span className="font-medium">Type:</span> CNAME</p>
                      <p><span className="font-medium">Host:</span> www</p>
                      <p><span className="font-medium">Value:</span> {dnsTargetHost}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3 text-sm">
                      <p><span className="font-medium">Type:</span> URL Redirect</p>
                      <p><span className="font-medium">Host:</span> @</p>
                      <p><span className="font-medium">Value:</span> https://{wwwHost}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    After saving, add these records at your DNS provider. DNS changes can take up to 24-48 hours.
                  </p>
                </div>
              </CardContent>
            </Card>

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

            {/* Company theme */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Theme</CardTitle>
                <CardDescription>Adjust your client portal header and button colors from here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="website-client-portal-color-picker">Brand Color</Label>
                    <Input
                      id="website-client-portal-color-picker"
                      type="color"
                      value={normalizedPortalColor}
                      onChange={(e) => {
                        setPortalColor(normalizeClientPortalColor(e.target.value));
                        markDirty();
                      }}
                      className="h-11 w-16 cursor-pointer rounded-md p-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website-client-portal-color-hex">Brand Color Hex</Label>
                    <Input
                      id="website-client-portal-color-hex"
                      value={portalColor}
                      onChange={(e) => {
                        setPortalColor(e.target.value);
                        markDirty();
                      }}
                      onBlur={() => setPortalColor(normalizeClientPortalColor(portalColor))}
                      placeholder="#334155"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website-client-portal-text-color-picker">Brand Text Color</Label>
                    <Input
                      id="website-client-portal-text-color-picker"
                      type="color"
                      value={normalizedPortalTextColor}
                      onChange={(e) => {
                        setPortalTextColor(normalizeClientPortalTextColor(e.target.value));
                        markDirty();
                      }}
                      className="h-11 w-16 cursor-pointer rounded-md p-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website-client-portal-text-color-hex">Brand Text Color Hex</Label>
                    <Input
                      id="website-client-portal-text-color-hex"
                      value={portalTextColor}
                      onChange={(e) => {
                        setPortalTextColor(e.target.value);
                        markDirty();
                      }}
                      onBlur={() => setPortalTextColor(normalizeClientPortalTextColor(portalTextColor))}
                      placeholder="#ffffff"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website-client-portal-highlight-color-picker">Highlight Color</Label>
                    <Input
                      id="website-client-portal-highlight-color-picker"
                      type="color"
                      value={normalizedPortalHighlightColor}
                      onChange={(e) => {
                        setPortalHighlightColor(normalizeClientPortalHighlightColor(e.target.value));
                        markDirty();
                      }}
                      className="h-11 w-16 cursor-pointer rounded-md p-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website-client-portal-highlight-color-hex">Highlight Color Hex</Label>
                    <Input
                      id="website-client-portal-highlight-color-hex"
                      value={portalHighlightColor}
                      onChange={(e) => {
                        setPortalHighlightColor(e.target.value);
                        markDirty();
                      }}
                      onBlur={() => setPortalHighlightColor(normalizeClientPortalHighlightColor(portalHighlightColor))}
                      placeholder="#f59e0b"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Wrap website copy in <code>**double asterisks**</code> for highlight color and <code>{`{{double braces}}`}</code> for brand color.
                </p>
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
                  <Label htmlFor="hero-image-upload">Header Image</Label>
                  <input
                    id="hero-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleHeroImageUpload}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional image for hero background. Recommended wide image. Max 5MB.
                  </p>
                  {heroImagePreviewUrl && (
                    <div className="space-y-2">
                      <img
                        src={heroImagePreviewUrl}
                        alt="Hero preview"
                        className="h-28 w-full rounded-lg border border-border object-cover"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (heroImagePreviewUrl.startsWith("blob:")) {
                            URL.revokeObjectURL(heroImagePreviewUrl);
                          }
                          setHeroImageUrl("");
                          setHeroImagePreviewUrl("");
                          setSelectedHeroImageFile(null);
                          markDirty();
                        }}
                        className="gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remove Header Image
                      </Button>
                    </div>
                  )}
                </div>
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

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
                <CardDescription>Tell visitors about your business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="about-heading">Heading</Label>
                  <Input
                    id="about-heading"
                    value={aboutHeading}
                    onChange={(e) => { setAboutHeading(e.target.value); markDirty(); }}
                    placeholder="About Us"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="about-subheading">Subheading</Label>
                  <Input
                    id="about-subheading"
                    value={aboutSubheading}
                    onChange={(e) => { setAboutSubheading(e.target.value); markDirty(); }}
                    placeholder="Learn more about our team and approach"
                  />
                </div>
                <Textarea
                  value={aboutText}
                  onChange={(e) => { setAboutText(e.target.value); markDirty(); }}
                  placeholder={`${currentAccount?.company_name || "We"} are committed to delivering top-quality service. We take pride in our work and treat every job as if it were our own home.`}
                  rows={5}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="about-before-image">Before Image</Label>
                    <input
                      id="about-before-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        handleAboutImageUpload("before", e.target.files?.[0]);
                        e.target.value = "";
                      }}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/50"
                    />
                    {(aboutBeforeImagePreviewUrl || aboutBeforeImageUrl) && (
                      <div className="space-y-2">
                        <img
                          src={aboutBeforeImagePreviewUrl || aboutBeforeImageUrl}
                          alt="Before preview"
                          className="h-24 w-full rounded-lg border border-border object-cover"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (aboutBeforeImagePreviewUrl.startsWith("blob:")) {
                              URL.revokeObjectURL(aboutBeforeImagePreviewUrl);
                            }
                            setAboutBeforeImageUrl("");
                            setAboutBeforeImagePreviewUrl("");
                            setSelectedAboutBeforeImageFile(null);
                            markDirty();
                          }}
                          className="gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove Before Image
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="about-after-image">After Image</Label>
                    <input
                      id="about-after-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        handleAboutImageUpload("after", e.target.files?.[0]);
                        e.target.value = "";
                      }}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/50"
                    />
                    {(aboutAfterImagePreviewUrl || aboutAfterImageUrl) && (
                      <div className="space-y-2">
                        <img
                          src={aboutAfterImagePreviewUrl || aboutAfterImageUrl}
                          alt="After preview"
                          className="h-24 w-full rounded-lg border border-border object-cover"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (aboutAfterImagePreviewUrl.startsWith("blob:")) {
                              URL.revokeObjectURL(aboutAfterImagePreviewUrl);
                            }
                            setAboutAfterImageUrl("");
                            setAboutAfterImagePreviewUrl("");
                            setSelectedAboutAfterImageFile(null);
                            markDirty();
                          }}
                          className="gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove After Image
                        </Button>
                      </div>
                    )}
                  </div>
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
                <div className="mb-8 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="services-section-header">Section Header</Label>
                    <Input
                      id="services-section-header"
                      value={servicesHeader}
                      onChange={(e) => { setServicesHeader(e.target.value); markDirty(); }}
                      placeholder="What We Offer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="services-section-subheading">Section Subheading</Label>
                    <Input
                      id="services-section-subheading"
                      value={servicesSubheading}
                      onChange={(e) => { setServicesSubheading(e.target.value); markDirty(); }}
                      placeholder="Reliable services tailored to your needs"
                    />
                  </div>
                </div>
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {displayedServices.map((name) => (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`service-enabled-${name}`}
                            checked={serviceEnabled[name] ?? true}
                            onCheckedChange={(checked) => {
                              setServiceEnabled((prev) => ({ ...prev, [name]: checked }));
                              markDirty();
                            }}
                            aria-label={`Toggle ${name} visibility`}
                          />
                          <p className="text-sm font-semibold text-foreground">{name}</p>
                        </div>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setEditingServiceName(name)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                            aria-label={`Edit ${name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Dialog
                  open={Boolean(editingService)}
                  onOpenChange={(open) => {
                    if (!open) setEditingServiceName(null);
                  }}
                >
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Service</DialogTitle>
                      <DialogDescription>
                        {editingService ? editingService.display_name : "Service settings"}
                      </DialogDescription>
                    </DialogHeader>

                    {editingService && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`service-image-${editingService.display_name}`}>Service Image</Label>
                          <input
                            id={`service-image-${editingService.display_name}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              handleServiceImageUpload(editingService.display_name, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/50"
                          />
                          {(serviceImagePreviews[editingService.display_name] || serviceImageUrls[editingService.display_name]) && (
                            <div className="space-y-2">
                              <img
                                src={serviceImagePreviews[editingService.display_name] || serviceImageUrls[editingService.display_name]}
                                alt={`${editingService.display_name} preview`}
                                className="h-24 w-full rounded-lg border border-border object-cover"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const key = editingService.display_name;
                                  const previewUrl = serviceImagePreviews[key];
                                  if (previewUrl?.startsWith("blob:")) {
                                    URL.revokeObjectURL(previewUrl);
                                  }
                                  setServiceImageUrls((prev) => ({ ...prev, [key]: "" }));
                                  setServiceImagePreviews((prev) => ({ ...prev, [key]: "" }));
                                  setSelectedServiceImageFiles((prev) => ({ ...prev, [key]: null }));
                                  markDirty();
                                }}
                                className="gap-1.5"
                              >
                                <X className="h-3.5 w-3.5" />
                                Remove Service Image
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Service Icon</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {ICON_OPTIONS.map(({ name: iconName, icon: IconComp }) => {
                              const selected = (serviceIcons[editingService.display_name] || "CheckCircle2") === iconName;
                              return (
                                <button
                                  key={iconName}
                                  type="button"
                                  onClick={() => {
                                    setServiceIcons((prev) => ({ ...prev, [editingService.display_name]: iconName }));
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
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`service-description-${editingService.display_name}`}>Description</Label>
                          <Textarea
                            id={`service-description-${editingService.display_name}`}
                            value={serviceDescriptions[editingService.display_name] || ""}
                            onChange={(e) => {
                              setServiceDescriptions((prev) => ({
                                ...prev,
                                [editingService.display_name]: e.target.value,
                              }));
                              markDirty();
                            }}
                            placeholder="Optional description for this service…"
                            rows={3}
                          />
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
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
                  {visibleServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Enable at least one service to show it on your website calculator.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Calculator rates and units are pulled directly from Pricing Rules.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {visibleServices.length} service{visibleServices.length === 1 ? "" : "s"} enabled for the calculator.
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Testimonials */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Testimonials</CardTitle>
                <CardDescription>
                  Highlight specific customer quotes. Headlines display in quotation marks on the site.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="testimonials-section-header">Section Headline</Label>
                    <Input
                      id="testimonials-section-header"
                      value={testimonialsHeader}
                      onChange={(e) => { setTestimonialsHeader(e.target.value); markDirty(); }}
                      placeholder="What Clients Say"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="testimonials-section-subheading">Section Subheadline</Label>
                    <Input
                      id="testimonials-section-subheading"
                      value={testimonialsSubheading}
                      onChange={(e) => { setTestimonialsSubheading(e.target.value); markDirty(); }}
                      placeholder="Trusted by homeowners and businesses in the area"
                    />
                  </div>
                </div>
                {testimonials.map((testimonial, index) => (
                  <div key={testimonial.id} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-sm font-semibold">Testimonial {index + 1}</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`testimonial-heading-${testimonial.id}`}>Headline</Label>
                        <Input
                          id={`testimonial-heading-${testimonial.id}`}
                          value={testimonial.heading}
                          onChange={(e) => updateTestimonialField(testimonial.id, "heading", e.target.value)}
                          placeholder="Fast, Flawless Service"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`testimonial-author-${testimonial.id}`}>Customer Name</Label>
                        <Input
                          id={`testimonial-author-${testimonial.id}`}
                          value={testimonial.author}
                          onChange={(e) => updateTestimonialField(testimonial.id, "author", e.target.value)}
                          placeholder="Alex T."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`testimonial-quote-${testimonial.id}`}>Quote Excerpt</Label>
                      <Textarea
                        id={`testimonial-quote-${testimonial.id}`}
                        value={testimonial.quote}
                        onChange={(e) => updateTestimonialField(testimonial.id, "quote", e.target.value)}
                        placeholder="They were punctual, professional, and delivered exceptional results."
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`testimonial-location-${testimonial.id}`}>Customer Title/Location</Label>
                        <Input
                          id={`testimonial-location-${testimonial.id}`}
                          value={testimonial.location}
                          onChange={(e) => updateTestimonialField(testimonial.id, "location", e.target.value)}
                          placeholder="Homeowner"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`testimonial-photo-${testimonial.id}`}>Customer Photo</Label>
                        <input
                          id={`testimonial-photo-${testimonial.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            handleTestimonialPhotoUpload(testimonial.id, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/50"
                        />
                        {(testimonialPhotoPreviews[testimonial.id] || testimonialPhotoUrls[testimonial.id]) && (
                          <div className="space-y-2">
                            <img
                              src={testimonialPhotoPreviews[testimonial.id] || testimonialPhotoUrls[testimonial.id]}
                              alt={`${testimonial.author || `Testimonial ${index + 1}`} photo`}
                              className="h-24 w-24 rounded-full border border-border object-cover"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const previewUrl = testimonialPhotoPreviews[testimonial.id];
                                if (previewUrl?.startsWith("blob:")) {
                                  URL.revokeObjectURL(previewUrl);
                                }
                                setTestimonialPhotoUrls((prev) => ({ ...prev, [testimonial.id]: "" }));
                                setTestimonialPhotoPreviews((prev) => ({ ...prev, [testimonial.id]: "" }));
                                setSelectedTestimonialPhotoFiles((prev) => ({ ...prev, [testimonial.id]: null }));
                                setTestimonials((prev) =>
                                  prev.map((entry) =>
                                    entry.id === testimonial.id ? { ...entry, photo_url: null } : entry,
                                  ),
                                );
                                markDirty();
                              }}
                              className="gap-1.5"
                            >
                              <X className="h-3.5 w-3.5" />
                              Remove Customer Photo
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
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

          </TabsContent>

          {/* ── PREVIEW TAB ── */}
          <TabsContent value="preview" className="mt-4">
            <div className="mb-3 flex w-full rounded-lg border border-border bg-muted/30 p-1 sm:w-fit" role="tablist" aria-label="Preview mode">
              <Button
                type="button"
                variant={previewMode === "website" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPreviewMode("website")}
                role="tab"
                aria-selected={previewMode === "website"}
                className="flex-1 sm:flex-none"
              >
                Website
              </Button>
              <Button
                type="button"
                variant={previewMode === "client-portal" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPreviewMode("client-portal")}
                role="tab"
                aria-selected={previewMode === "client-portal"}
                className="flex-1 sm:flex-none"
              >
                Client Portal
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 rounded-md bg-background px-3 py-1 text-center text-xs text-muted-foreground truncate">
                  {previewMode === "website" ? siteUrl || "yoursite.leadsig.ai" : "client-portal.leadsig.ai"}
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {previewMode === "website" ? (
                  <LandingPageView
                    config={liveConfig}
                    themeColor={normalizedPortalColor}
                    themeTextColor={normalizedPortalTextColor}
                    themeHighlightColor={normalizedPortalHighlightColor}
                    companyName={currentAccount?.company_name || "Your Company"}
                    companyPhone={currentAccount?.company_phone}
                    companyEmail={currentAccount?.company_email}
                    companyAddress={currentAccount?.company_address}
                    logoUrl={currentAccount?.logo_url}
                    accountId={currentAccount?.id}
                  />
                ) : (
                  <div
                    data-testid="website-client-portal-preview"
                    className="client-portal-themed space-y-4 bg-slate-50 p-4"
                    style={previewPortalThemeStyle}
                  >
                    <ClientPortalHeader
                      job={previewJob}
                      company={previewCompany}
                      estimate={previewEstimate}
                      statusLabel="In Progress"
                      statusColor="bg-blue-100 text-blue-800"
                      portalColor={normalizedPortalColor}
                      portalTextColor={normalizedPortalTextColor}
                    />
                    <div className="overflow-hidden rounded-xl border border-border bg-white p-5">
                      <p className="mb-4 text-sm text-slate-600">Scheduled for Monday, 9:00 AM to 11:00 AM</p>
                      <button
                        type="button"
                        className="w-full rounded-lg px-4 py-2.5 text-sm font-medium"
                        style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
                        disabled
                      >
                        Pay Invoice
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <StickyActionBar
        onSave={() => {
          if (!isDirty || isSaving || isUploadingHeroImage) return;
          void handleSave();
        }}
        isSaving={isSaving || isUploadingHeroImage}
        disabled={!isDirty || activeTab !== "edit" || isUploadingHeroImage}
      />

      <MobileNav />
    </div>
  );
}
