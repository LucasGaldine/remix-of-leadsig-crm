import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsCompanyProfile() {
  const navigate = useNavigate();
  const { currentAccount, refreshProfile } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (currentAccount) {
      setCompanyName(currentAccount.company_name || "");
      setCompanyEmail(currentAccount.company_email || "");
      setCompanyPhone(currentAccount.company_phone || "");
      setCompanyAddress(currentAccount.company_address || "");
      setBillingEmail(currentAccount.billing_email || "");
      setWebsite(currentAccount.website || "");
    }
  }, [currentAccount]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentAccount) {
      toast.error("No account selected");
      return;
    }

    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("accounts")
      .update({
        company_name: companyName.trim(),
        company_email: companyEmail.trim() || null,
        company_phone: companyPhone.trim() || null,
        company_address: companyAddress.trim() || null,
        billing_email: billingEmail.trim() || null,
        website: website.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentAccount.id);

    setIsSaving(false);

    if (error) {
      console.error("Error updating company profile:", error);
      toast.error("Failed to update company profile");
      return;
    }

    toast.success("Company profile updated successfully");
    await refreshProfile();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Profile</h1>
          <p className="text-muted-foreground">
            Manage your business information for estimates and invoices
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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
              <Label htmlFor="company-name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
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
                  onChange={(e) => setCompanyEmail(e.target.value)}
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
                  onChange={(e) => setCompanyPhone(e.target.value)}
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
                onChange={(e) => setCompanyAddress(e.target.value)}
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
                  onChange={(e) => setBillingEmail(e.target.value)}
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
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.company.com"
                  disabled={isSaving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/settings")}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
