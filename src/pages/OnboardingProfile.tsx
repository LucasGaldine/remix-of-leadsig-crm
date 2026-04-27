import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, Check, Copy, Loader2, Plus, Trash2, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { ClientPortalHeader } from "@/components/client-portal/ClientPortalHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MockCrewProfileDialog } from "@/components/crew/MockCrewProfileDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatServiceTypeOption } from "@/hooks/useServiceTypeOptions";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { completeOnboardingProfile } from "@/lib/onboarding";
import {
  darkenHexColor,
  DEFAULT_CLIENT_PORTAL_COLOR,
  DEFAULT_CLIENT_PORTAL_TEXT_COLOR,
  hexToRgba,
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";
import {
  getCompanyLogoStoragePath,
  getCompanyLogoValidationError,
  loadImageDimensions,
} from "@/lib/companyLogo";
import { normalizeCrewDescription } from "@/lib/crewDescription";
import { isMissingRelationError } from "@/lib/supabaseErrors";
import { supabase } from "@/integrations/supabase/client";

interface MockCrewProfile {
  id: string;
  full_name: string;
  role: "crew_lead" | "crew_member";
}

const profileSlideMeta = [
  {
    title: "Upload Company Logo",
    description: "Upload your company logo.",
  },
  {
    title: "Add Your Services",
    description: "Add the services your company offers.",
  },
  {
    title: "Client Portal Theme",
    description: "Set your client portal brand colors.",
  },
  {
    title: "Invite Your Team",
    description: "Copy your invite code and add mock crew members.",
  },
  {
    title: "Pricing Defaults",
    description: "Set your default tax rate, profit margin, and surcharge.",
  },
] as const;

export default function OnboardingProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentAccount, refreshProfile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const isReplay = searchParams.get("source") === "search";
  const { status: stripeStatus, connecting: stripeConnecting, startOnboarding: startStripeOnboarding } = useStripeConnect();

  const [activeSlide, setActiveSlide] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [portalColor, setPortalColor] = useState(DEFAULT_CLIENT_PORTAL_COLOR);
  const [portalTextColor, setPortalTextColor] = useState(DEFAULT_CLIENT_PORTAL_TEXT_COLOR);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [brandingDirty, setBrandingDirty] = useState(false);
  const [taxRate, setTaxRate] = useState("");
  const [profitMargin, setProfitMargin] = useState("");
  const [surcharge, setSurcharge] = useState("");
  const [pricingDefaultsDirty, setPricingDefaultsDirty] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");

  const [mockMemberName, setMockMemberName] = useState("");
  const [mockMemberPhone, setMockMemberPhone] = useState("");
  const [mockMemberDescription, setMockMemberDescription] = useState("");
  const [mockMemberRole, setMockMemberRole] = useState<"crew_lead" | "crew_member">("crew_member");
  const [showAddMockMemberModal, setShowAddMockMemberModal] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!currentAccount) return;

    setPortalColor(normalizeClientPortalColor(currentAccount.settings?.client_portal_color));
    setPortalTextColor(normalizeClientPortalTextColor(currentAccount.settings?.client_portal_text_color));
    setLogoUrl(currentAccount.logo_url || "");
    if (!selectedLogoFile) {
      setLogoPreviewUrl(currentAccount.logo_url || "");
    }
    setBrandingDirty(false);
  }, [currentAccount, selectedLogoFile]);

  useEffect(() => {
    if (!currentAccount?.id || !user?.id) return;
    let isCancelled = false;

    const loadServices = async () => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("service_type")
        .eq("account_id", currentAccount.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (isCancelled) return;

      if (error) {
        toast.error("Failed to load services");
        return;
      }

      const nextServices = Array.from(
        new Set(
          (data || [])
            .map((row) => String((row as { service_type?: string }).service_type || "").trim())
            .filter(Boolean),
        ),
      );

      setServices(nextServices);
      setServiceInput("");
    };

    void loadServices();

    return () => {
      isCancelled = true;
    };
  }, [currentAccount?.id, user?.id]);

  useEffect(() => {
    if (!currentAccount) return;
    setTaxRate(String(currentAccount.default_tax_rate ?? 8));
    setProfitMargin(String(currentAccount.default_profit_margin ?? 0));
    setSurcharge(String(currentAccount.default_surcharge ?? 0));
    setPricingDefaultsDirty(false);
  }, [currentAccount]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const { data: mockProfiles = [] } = useQuery({
    queryKey: ["mock-crew-profiles", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount?.id) return [] as MockCrewProfile[];

      const { data, error } = await supabase
        .from("mock_crew_profiles")
        .select("id, full_name, role")
        .eq("account_id", currentAccount.id)
        .order("created_at", { ascending: false });

      if (error && !isMissingRelationError(error, "mock_crew_profiles")) {
        throw error;
      }

      return (data || []) as MockCrewProfile[];
    },
    enabled: !!currentAccount?.id,
  });

  const addMockMemberMutation = useMutation({
    mutationFn: async () => {
      if (!currentAccount?.id) throw new Error("Missing account");
      if (!mockMemberName.trim()) throw new Error("Name is required");

      const { error } = await supabase.from("mock_crew_profiles").insert({
        account_id: currentAccount.id,
        full_name: mockMemberName.trim(),
        phone: mockMemberPhone.trim() || null,
        description: normalizeCrewDescription(mockMemberDescription),
        role: mockMemberRole,
      });

      if (error) {
        if (isMissingRelationError(error, "mock_crew_profiles")) {
          throw new Error("Mock crew profiles are unavailable until the latest database migration is applied.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mock-crew-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setMockMemberName("");
      setMockMemberPhone("");
      setMockMemberDescription("");
      setMockMemberRole("crew_member");
      setShowAddMockMemberModal(false);
      toast.success("Mock crew member added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add mock crew member");
    },
  });

  const removeMockMemberMutation = useMutation({
    mutationFn: async (mockProfileId: string) => {
      const { error } = await supabase
        .from("mock_crew_profiles")
        .delete()
        .eq("id", mockProfileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mock-crew-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Mock crew member removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove mock crew member");
    },
  });

  const handleCopyInviteCode = async () => {
    if (!currentAccount?.invite_code) return;

    try {
      await navigator.clipboard.writeText(currentAccount.invite_code);
      setCopiedCode(true);
      toast.success("Invite code copied");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Failed to copy invite code");
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dimensions = await loadImageDimensions(file);
      const validationError = getCompanyLogoValidationError(file, dimensions);
      if (validationError) {
        toast.error(validationError);
        event.target.value = "";
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      if (logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }

      setSelectedLogoFile(file);
      setLogoPreviewUrl(objectUrl);
      setBrandingDirty(true);
    } catch {
      toast.error("Unable to read logo file");
      event.target.value = "";
    }
  };

  const addService = () => {
    const normalizedValue = serviceInput.trim();
    if (!normalizedValue) return;

    const alreadyExists = services.some((service) => service.toLowerCase() === normalizedValue.toLowerCase());
    if (alreadyExists) {
      toast.error("That service is already listed");
      return;
    }

    setServices((current) => [...current, normalizedValue]);
    setServiceInput("");
    setBrandingDirty(true);
  };

  const removeService = (serviceToRemove: string) => {
    setServices((current) => current.filter((service) => service !== serviceToRemove));
    setBrandingDirty(true);
  };

  const saveBranding = async () => {
    if (!currentAccount?.id || !user?.id) {
      toast.error("Missing account");
      return false;
    }

    setIsSavingBranding(true);

    let uploadedLogoUrl: string | null = logoUrl || null;

    if (selectedLogoFile) {
      setIsUploadingLogo(true);
      try {
        const fileExt = selectedLogoFile.name.split(".").pop() || "png";
        const filePath = getCompanyLogoStoragePath(currentAccount.id, Date.now(), fileExt);

        const { error: uploadError } = await supabase.storage
          .from("profiles")
          .upload(filePath, selectedLogoFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: logoData } = supabase.storage.from("profiles").getPublicUrl(filePath);
        uploadedLogoUrl = logoData.publicUrl;
      } catch {
        toast.error("Failed to upload logo");
        setIsUploadingLogo(false);
        setIsSavingBranding(false);
        return false;
      } finally {
        setIsUploadingLogo(false);
      }
    }

    const { error } = await supabase
      .from("accounts")
      .update({
        logo_url: uploadedLogoUrl,
        settings: {
          ...(currentAccount.settings || {}),
          client_portal_color: normalizeClientPortalColor(portalColor),
          client_portal_text_color: normalizeClientPortalTextColor(portalTextColor),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentAccount.id);

    if (error) {
      setIsSavingBranding(false);
      toast.error("Failed to save profile branding");
      return false;
    }

    const normalizedServices = Array.from(
      new Set(
        services
          .map((service) => service.trim())
          .filter(Boolean),
      ),
    );

    if (normalizedServices.length > 0) {
      const { error: serviceSaveError } = await supabase
        .from("pricing_rules")
        .upsert(
          normalizedServices.map((serviceType) => ({
            user_id: user.id,
            account_id: currentAccount.id,
            service_type: serviceType,
          })),
          {
            onConflict: "user_id,service_type",
            ignoreDuplicates: true,
          },
        );

      if (serviceSaveError) {
        setIsSavingBranding(false);
        toast.error("Failed to save service types");
        return false;
      }
    }

    setLogoUrl(uploadedLogoUrl || "");
    setLogoPreviewUrl(uploadedLogoUrl || "");
    setSelectedLogoFile(null);
    setBrandingDirty(false);
    setIsSavingBranding(false);
    toast.success("Profile branding saved");
    await refreshProfile();
    return true;
  };

  const continueToImport = async () => {
    if (brandingDirty) {
      const didSave = await saveBranding();
      if (!didSave) return;
    }

    if (pricingDefaultsDirty) {
      const didSavePricingDefaults = await savePricingDefaults();
      if (!didSavePricingDefaults) return;
    }

    completeOnboardingProfile();
    navigate(isReplay ? "/onboarding/import?source=search" : "/onboarding/import");
  };

  const continueSlide = async () => {
    if ((activeSlide === 0 || activeSlide === 1 || activeSlide === 2) && brandingDirty) {
      const didSave = await saveBranding();
      if (!didSave) return;
    }

    setActiveSlide((slideIndex) => Math.min(profileSlideMeta.length - 1, slideIndex + 1));
  };

  const savePricingDefaults = async () => {
    if (!currentAccount?.id) {
      toast.error("Missing account");
      return false;
    }

    const parsedTax = parseFloat(taxRate) || 0;
    const parsedProfitMargin = parseFloat(profitMargin) || 0;
    const parsedSurcharge = parseFloat(surcharge) || 0;

    const { error } = await supabase
      .from("accounts")
      .update({
        default_tax_rate: parsedTax,
        default_profit_margin: parsedProfitMargin,
        default_surcharge: parsedSurcharge,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentAccount.id);

    if (error) {
      toast.error("Failed to save pricing defaults");
      return false;
    }

    setPricingDefaultsDirty(false);
    toast.success("Pricing defaults saved");
    await refreshProfile();
    return true;
  };

  const normalizedPortalColor = normalizeClientPortalColor(portalColor);
  const normalizedPortalTextColor = normalizeClientPortalTextColor(portalTextColor);
  const previewJob = {
    name: "Spring Cleanup",
    address: "123 Main St",
    service_type: "Lawn Care",
    customer: { name: "Sarah" },
  };
  const previewCompany = {
    company_name: currentAccount?.company_name || "Your Company",
    logo_url: logoPreviewUrl || undefined,
  };
  const previewEstimate = { total: 350 };
  const previewPortalColorDark = darkenHexColor(normalizedPortalColor, 0.16);
  const previewPortalThemeStyle = {
    "--client-portal-color": normalizedPortalColor,
    "--client-portal-color-dark": previewPortalColorDark,
    "--client-portal-text-color": normalizedPortalTextColor,
    "--client-portal-text-muted": hexToRgba(normalizedPortalTextColor, 0.72),
    "--client-portal-text-subtle": hexToRgba(normalizedPortalTextColor, 0.56),
  } as React.CSSProperties;
  const slide = profileSlideMeta[activeSlide];

  return (
    <div className="min-h-screen bg-surface-sunken pb-10">
      <PageHeader
        title=""
        hideTitle
        profileClickable={false}
        showNotifications={false}
        showSearch={false}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Step 2 of 3</div>
          <div className="grid grid-cols-3 gap-2" aria-hidden>
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-muted" />
          </div>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Set up your company</CardTitle>
            <CardDescription className="text-base">{slide.description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {activeSlide === 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Company Logo</Label>
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Company logo preview" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                <Input
                  id="onboarding-company-logo"
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={isSavingBranding || isUploadingLogo}
                  className="sr-only"
                />

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isSavingBranding || isUploadingLogo}
                >
                  {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {logoPreviewUrl ? "Replace logo" : "Upload logo"}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG, or WebP up to 5MB.</p>
              </div>
            )}

            {activeSlide === 1 && (
              <div className="space-y-3">
                <Label htmlFor="onboarding-service-input" className="text-sm font-medium">
                  Add your services
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="onboarding-service-input"
                    value={serviceInput}
                    onChange={(event) => setServiceInput(event.target.value)}
                    placeholder="e.g. Lawn Care"
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addService();
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addService}>
                    Add
                  </Button>
                </div>

                {services.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No services added yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-medium">Your Services</p>
                    <div className="flex flex-wrap gap-2">
                      {services.map((service) => (
                        <div key={service} className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">
                          <span>{formatServiceTypeOption(service)}</span>
                          <button
                            type="button"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Remove ${formatServiceTypeOption(service)}`}
                            onClick={() => removeService(service)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSlide === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="onboarding-portal-color">Accent</Label>
                    <div className="flex items-center gap-2">
                        <Input
                          id="onboarding-portal-color"
                          type="color"
                        value={normalizedPortalColor}
                        onChange={(event) => {
                          setPortalColor(event.target.value);
                          setBrandingDirty(true);
                        }}
                          className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-0 [appearance:none] [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-[5px] [&::-moz-color-swatch]:border-0"
                          style={{ borderColor: normalizedPortalTextColor }}
                        />
                        <Input
                          value={portalColor}
                        onChange={(event) => {
                          setPortalColor(event.target.value);
                          setBrandingDirty(true);
                        }}
                          className="min-w-0"
                        />
                      </div>
                    </div>

                  <div className="space-y-2">
                    <Label htmlFor="onboarding-portal-text-color">Text</Label>
                    <div className="flex items-center gap-2">
                        <Input
                          id="onboarding-portal-text-color"
                          type="color"
                        value={normalizedPortalTextColor}
                        onChange={(event) => {
                          setPortalTextColor(event.target.value);
                          setBrandingDirty(true);
                        }}
                          className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-0 [appearance:none] [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-[5px] [&::-moz-color-swatch]:border-0"
                          style={{ borderColor: normalizedPortalColor }}
                        />
                        <Input
                          value={portalTextColor}
                        onChange={(event) => {
                          setPortalTextColor(event.target.value);
                          setBrandingDirty(true);
                        }}
                          className="min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                <div className="rounded-lg border bg-background p-4" style={{ borderColor: `${normalizedPortalColor}55` }}>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Portal preview</p>
                  <div className="client-portal-themed space-y-4" style={previewPortalThemeStyle}>
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
                      <p className="mb-4 text-sm text-slate-600">
                        Scheduled for Monday, 9:00 AM to 11:00 AM
                      </p>
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
                </div>
              </div>
            )}

            {activeSlide === 3 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="onboarding-invite-code">Company Invite Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="onboarding-invite-code"
                      value={currentAccount?.invite_code || ""}
                      readOnly
                      className="font-mono text-lg tracking-wider"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopyInviteCode}
                      disabled={!currentAccount?.invite_code}
                    >
                      {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this code with real team members when they sign up.
                  </p>
                </div>

                <div className="h-px w-full bg-border" />

                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Mock Crew Members
                </div>
                <p className="text-xs text-muted-foreground">
                  Mock crew members are placeholders so you can test assignments and scheduling before inviting your real team.
                </p>

                <div className="max-h-[10.5rem] space-y-2 overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
                  {mockProfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No mock crew members yet.</p>
                  ) : (
                    mockProfiles.map((profile) => (
                      <div key={profile.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {profile.role === "crew_lead" ? "Crew lead" : "Crew member"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMockMemberMutation.mutate(profile.id)}
                          disabled={removeMockMemberMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    setMockMemberName("");
                    setMockMemberPhone("");
                    setMockMemberDescription("");
                    setMockMemberRole("crew_member");
                    setShowAddMockMemberModal(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add member
                </Button>
              </div>
            )}

            {activeSlide === 4 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="onboarding-default-tax-rate">Default Tax Rate (%)</Label>
                    <Input
                      id="onboarding-default-tax-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={taxRate}
                      onChange={(event) => {
                        setTaxRate(event.target.value);
                        setPricingDefaultsDirty(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onboarding-default-profit-margin">Default Profit Margin (%)</Label>
                    <Input
                      id="onboarding-default-profit-margin"
                      type="number"
                      min="0"
                      step="0.01"
                      value={profitMargin}
                      onChange={(event) => {
                        setProfitMargin(event.target.value);
                        setPricingDefaultsDirty(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onboarding-default-surcharge">Default Surcharge (%)</Label>
                    <Input
                      id="onboarding-default-surcharge"
                      type="number"
                      min="0"
                      step="0.01"
                      value={surcharge}
                      onChange={(event) => {
                        setSurcharge(event.target.value);
                        setPricingDefaultsDirty(true);
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  These defaults are used when creating estimates and can be changed later in Pricing Rules.
                </p>

                <div className="h-px w-full bg-border" />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Connect Stripe</p>
                  <p className="text-xs text-muted-foreground">
                    Connect Stripe now to start accepting online payments as soon as onboarding is complete.
                  </p>
                </div>

                <Button
                  type="button"
                  variant={stripeStatus?.connected ? "outline" : "default"}
                  className="w-full sm:w-auto"
                  onClick={startStripeOnboarding}
                  disabled={stripeConnecting || stripeStatus?.connected}
                >
                  {stripeConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting Stripe...
                    </>
                  ) : stripeStatus?.connected ? (
                    "Stripe Connected"
                  ) : (
                    "Connect Stripe"
                  )}
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-3">
              {activeSlide > 0 && (
                <Button type="button" variant="outline" onClick={() => setActiveSlide((slideIndex) => Math.max(0, slideIndex - 1))}>
                  Back
                </Button>
              )}

              {activeSlide < profileSlideMeta.length - 1 ? (
                <Button type="button" className="flex-1 sm:flex-none" onClick={() => void continueSlide()}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" className="flex-1 sm:flex-none" onClick={() => void continueToImport()} disabled={isSavingBranding}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <MockCrewProfileDialog
        open={showAddMockMemberModal}
        onOpenChange={(open) => {
          setShowAddMockMemberModal(open);
          if (!open) {
            setMockMemberName("");
            setMockMemberPhone("");
            setMockMemberDescription("");
            setMockMemberRole("crew_member");
          }
        }}
        isEdit={false}
        isSaving={addMockMemberMutation.isPending}
        name={mockMemberName}
        onNameChange={setMockMemberName}
        phone={mockMemberPhone}
        onPhoneChange={setMockMemberPhone}
        description={mockMemberDescription}
        onDescriptionChange={setMockMemberDescription}
        role={mockMemberRole}
        onRoleChange={setMockMemberRole}
        onSave={() => addMockMemberMutation.mutate()}
      />
    </div>
  );
}
