import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, Copy, Check, Users, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { ClientPortalHeader } from "@/components/client-portal/ClientPortalHeader";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getCompanyLogoStoragePath,
  getCompanyLogoValidationError,
  loadImageDimensions,
} from "@/lib/companyLogo";
import {
  darkenHexColor,
  DEFAULT_CLIENT_PORTAL_COLOR,
  DEFAULT_CLIENT_PORTAL_TEXT_COLOR,
  hexToRgba,
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";
import { toast } from "sonner";

export default function SettingsCompanyProfile() {
  const navigate = useNavigate();
  const { currentAccount, refreshProfile } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);

  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [portalColor, setPortalColor] = useState(DEFAULT_CLIENT_PORTAL_COLOR);
  const [portalTextColor, setPortalTextColor] = useState(DEFAULT_CLIENT_PORTAL_TEXT_COLOR);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentAccount) {
      setCompanyName(currentAccount.company_name || "");
      setCompanyEmail(currentAccount.company_email || "");
      setCompanyPhone(currentAccount.company_phone || "");
      setCompanyAddress(currentAccount.company_address || "");
      setBillingEmail(currentAccount.billing_email || "");
      setWebsite(currentAccount.website || "");
      setInviteCode(currentAccount.invite_code || "");
      setLogoUrl(currentAccount.logo_url || "");
      setLogoPreviewUrl(currentAccount.logo_url || "");
      setPortalColor(normalizeClientPortalColor(currentAccount.settings?.client_portal_color));
      setPortalTextColor(normalizeClientPortalTextColor(currentAccount.settings?.client_portal_text_color));
      setSelectedLogoFile(null);
    }
  }, [currentAccount]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl && logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const handleCopyCode = async () => {
    if (!inviteCode) return;

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      toast.success("Company code copied to clipboard");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      toast.error("Failed to copy code");
    }
  };

  const handleSave = async () => {
    if (!currentAccount) {
      toast.error("No account selected");
      return false;
    }

    if (!companyName.trim()) {
      toast.error("Company name is required");
      return false;
    }

    setIsSaving(true);

    let uploadedLogoUrl = logoUrl || null;

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

        const { data: urlData } = supabase.storage.from("profiles").getPublicUrl(filePath);
        uploadedLogoUrl = urlData.publicUrl;
      } catch (error) {
        console.error("Error uploading company logo:", error);
        toast.error("Failed to upload company logo");
        setIsUploadingLogo(false);
        setIsSaving(false);
        return false;
      } finally {
        setIsUploadingLogo(false);
      }
    }

    const { error } = await supabase
      .from("accounts")
      .update({
        company_name: companyName.trim(),
        company_email: companyEmail.trim() || null,
        company_phone: companyPhone.trim() || null,
        company_address: companyAddress.trim() || null,
        billing_email: billingEmail.trim() || null,
        website: website.trim() || null,
        logo_url: uploadedLogoUrl,
        settings: {
          ...(currentAccount.settings || {}),
          client_portal_color: normalizeClientPortalColor(portalColor),
          client_portal_text_color: normalizeClientPortalTextColor(portalTextColor),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentAccount.id);

    setIsSaving(false);

    if (error) {
      console.error("Error updating company profile:", error);
      toast.error("Failed to update company profile");
      return false;
    }

    setIsDirty(false);
    setLogoUrl(uploadedLogoUrl || "");
    setSelectedLogoFile(null);
    toast.success("Company profile updated successfully");
    await refreshProfile();
    return true;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dimensions = await loadImageDimensions(file);
      const validationError = getCompanyLogoValidationError(file, dimensions);
      if (validationError) {
        toast.error(validationError);
        e.target.value = "";
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      if (logoPreviewUrl && logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }

      setSelectedLogoFile(file);
      setLogoPreviewUrl(objectUrl);
      setIsDirty(true);
      toast.success("Logo ready to save");
    } catch (error) {
      console.error("Error validating company logo:", error);
      toast.error("Unable to read logo file");
      e.target.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSave();
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
    company_name: companyName || "Your Company",
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

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Company Profile"
        showBack
        backTo="/settings"
      />

      <form onSubmit={handleSubmitForm} className="px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team
            </CardTitle>
            <CardDescription>
              Share this code with team members to invite them to join your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="invite-code">Company Invite Code</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-code"
                  value={inviteCode}
                  readOnly
                  className="font-mono text-lg tracking-wider"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                  disabled={!inviteCode}
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                New team members will need this code during signup to join your company
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>
              This information will appear on your estimates, invoices, and customer communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-logo">Company Logo</Label>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt={`${companyName || "Company"} logo`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Label
                    htmlFor="company-logo"
                    className="sr-only"
                  >
                    Company Logo
                  </Label>
                  <Input
                    id="company-logo"
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={isSaving || isUploadingLogo}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isSaving || isUploadingLogo}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {logoPreviewUrl ? "Replace Logo" : "Upload Logo"}
                    </Button>
                    <p className="truncate text-sm text-muted-foreground">
                      {selectedLogoFile?.name || (logoPreviewUrl ? "Current logo selected" : "No file selected")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a PNG, JPG, SVG, or WebP logo up to 2MB. Logo must be between 1:1 and 4:1.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setIsDirty(true); }}
                placeholder="Your Company Name"
                disabled={isSaving}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-email">Company Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => { setCompanyEmail(e.target.value); setIsDirty(true); }}
                  placeholder="contact@company.com"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-phone">Company Phone</Label>
                <Input
                  id="company-phone"
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => { setCompanyPhone(e.target.value); setIsDirty(true); }}
                  placeholder="(555) 123-4567"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-address">Business Address</Label>
              <Textarea
                id="company-address"
                value={companyAddress}
                onChange={(e) => { setCompanyAddress(e.target.value); setIsDirty(true); }}
                placeholder="123 Main Street&#10;City, State 12345"
                disabled={isSaving}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This address will appear on your invoices and estimates
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billing-email">Billing Email</Label>
                <Input
                  id="billing-email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => { setBillingEmail(e.target.value); setIsDirty(true); }}
                  placeholder="billing@company.com"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Separate email for billing notifications
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => { setWebsite(e.target.value); setIsDirty(true); }}
                  placeholder="https://www.company.com"
                  disabled={isSaving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Portal Preview</CardTitle>
            <CardDescription>
              Choose a brand color for your client portal header and action buttons.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-portal-color-picker">Portal Color</Label>
                <Input
                  id="client-portal-color-picker"
                  type="color"
                  value={normalizedPortalColor}
                  onChange={(e) => {
                    setPortalColor(normalizeClientPortalColor(e.target.value));
                    setIsDirty(true);
                  }}
                  disabled={isSaving}
                  className="h-11 w-16 cursor-pointer rounded-md p-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-portal-color-hex">Hex Value</Label>
                <Input
                  id="client-portal-color-hex"
                  value={portalColor}
                  onChange={(e) => {
                    setPortalColor(e.target.value);
                    setIsDirty(true);
                  }}
                  onBlur={() => setPortalColor(normalizeClientPortalColor(portalColor))}
                  placeholder="#334155"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Use a hex color like #1e3a8a. Invalid values reset to the default portal color.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-portal-text-color-picker">Portal Text Color</Label>
                <Input
                  id="client-portal-text-color-picker"
                  type="color"
                  value={normalizedPortalTextColor}
                  onChange={(e) => {
                    setPortalTextColor(normalizeClientPortalTextColor(e.target.value));
                    setIsDirty(true);
                  }}
                  disabled={isSaving}
                  className="h-11 w-16 cursor-pointer rounded-md p-1"
                />
                <Label htmlFor="client-portal-text-color-hex">Hex Value</Label>
                <Input
                  id="client-portal-text-color-hex"
                  value={portalTextColor}
                  onChange={(e) => {
                    setPortalTextColor(e.target.value);
                    setIsDirty(true);
                  }}
                  onBlur={() => setPortalTextColor(normalizeClientPortalTextColor(portalTextColor))}
                  placeholder="#0f172a"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Use a hex color like #0f172a. Invalid values reset to the default text color.
                </p>
              </div>
            </div>

            <div
              data-testid="client-portal-preview-container"
              className="w-full"
            >
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
                  <p className="text-sm text-slate-600 mb-4">
                    Scheduled for Monday, 9:00 AM to 11:00 AM
                  </p>
                  <button
                    type="button"
                    className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white"
                    style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
                    disabled
                  >
                    Pay Invoice
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <StickyActionBar
          onSave={() => {
            if (!companyName.trim()) {
              toast.error("Company name is required");
              return;
            }
            void handleSave();
          }}
          isSaving={isSaving || isUploadingLogo}
        />
      </form>

      <MobileNav />
      <UnsavedChangesDialog blocker={blocker} onSaveAndLeave={handleSave} />
    </div>
  );
}
