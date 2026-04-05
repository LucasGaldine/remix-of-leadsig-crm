import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AffiliateSignupResult {
  affiliate_id: string;
  referral_code: string;
  referral_link: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MARKETING_PLAN_LENGTH = 10;

function normalizeSignupResult(data: unknown): AffiliateSignupResult | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return (data[0] as AffiliateSignupResult | undefined) ?? null;
  }

  return data as AffiliateSignupResult;
}

export default function AffiliateSignup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [marketingPlan, setMarketingPlan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AffiliateSignupResult | null>(null);

  const referralLink = useMemo(() => result?.referral_link ?? "", [result]);
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();
  const trimmedMarketingPlan = marketingPlan.trim();
  const isNameValid = trimmedName.length > 0;
  const isEmailPresent = trimmedEmail.length > 0;
  const isEmailValid = isEmailPresent && EMAIL_PATTERN.test(trimmedEmail);
  const isMarketingPlanPresent = trimmedMarketingPlan.length > 0;
  const isMarketingPlanValid = trimmedMarketingPlan.length >= MIN_MARKETING_PLAN_LENGTH;
  const canSubmit = isNameValid && isEmailValid && isMarketingPlanValid && !isSubmitting;

  const missingRequirements = useMemo(() => {
    const missing: string[] = [];

    if (!isNameValid) {
      missing.push("Full Name");
    }

    if (!isEmailPresent) {
      missing.push("Email");
    } else if (!isEmailValid) {
      missing.push("Valid Email");
    }

    if (!isMarketingPlanPresent) {
      missing.push("Promotion Strategy");
    } else if (!isMarketingPlanValid) {
      missing.push(`Promotion Strategy (${MIN_MARKETING_PLAN_LENGTH}+ chars)`);
    }

    return missing;
  }, [isEmailPresent, isEmailValid, isMarketingPlanPresent, isMarketingPlanValid, isNameValid]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isNameValid || !isEmailPresent || !isMarketingPlanPresent) {
      toast.error("Name, email, and promotion strategy are required");
      return;
    }

    if (!isEmailValid) {
      toast.error("Please enter a valid email");
      return;
    }

    if (!isMarketingPlanValid) {
      toast.error(`Please share at least ${MIN_MARKETING_PLAN_LENGTH} characters about your promotion plan`);
      return;
    }

    setIsSubmitting(true);

    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.rpc("upsert_affiliate_signup", {
      p_full_name: trimmedName,
      p_email: trimmedEmail,
      p_marketing_plan: trimmedMarketingPlan,
      p_base_url: window.location.origin,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to create affiliate account");
      return;
    }

    const normalized = normalizeSignupResult(data);
    if (!normalized) {
      toast.error("Could not generate your affiliate link");
      return;
    }

    setResult(normalized);
    toast.success("Affiliate account ready");
  };

  const copyReferralLink = async () => {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied");
    } catch {
      toast.error("Unable to copy automatically. Please copy manually.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/40 p-4">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Affiliate Program Signup</CardTitle>
            <CardDescription>
              Get your referral link and earn 20% of referred customer revenue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="affiliate-name">Full Name</Label>
                <Input
                  id="affiliate-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  disabled={isSubmitting}
                  required
                  aria-required="true"
                  aria-invalid={isNameValid ? "false" : "true"}
                  className={isNameValid ? undefined : "border-destructive"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliate-email">Email</Label>
                <Input
                  id="affiliate-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  required
                  aria-required="true"
                  aria-invalid={isEmailPresent && !isEmailValid ? "true" : "false"}
                  className={isEmailPresent && !isEmailValid ? "border-destructive" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliate-marketing-plan">How do you plan to promote your affiliate link?</Label>
                <Textarea
                  id="affiliate-marketing-plan"
                  value={marketingPlan}
                  onChange={(event) => setMarketingPlan(event.target.value)}
                  placeholder="Example: I will post tutorials on social media, email my client list, and share in local groups."
                  disabled={isSubmitting}
                  required
                  aria-required="true"
                  aria-invalid={isMarketingPlanPresent && !isMarketingPlanValid ? "true" : "false"}
                  className={isMarketingPlanPresent && !isMarketingPlanValid ? "border-destructive" : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Share the channels or tactics you plan to use ({MIN_MARKETING_PLAN_LENGTH}+ characters).
                </p>
              </div>
              {missingRequirements.length > 0 && (
                <p className="text-sm text-destructive" role="status">
                  Complete required fields: {missingRequirements.join(", ")}
                </p>
              )}
              <Button className="w-full" type="submit" disabled={!canSubmit}>
                {isSubmitting ? "Creating affiliate account..." : "Create Affiliate Link"}
              </Button>
            </form>

            {result && (
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">
                  Your referral code: <span className="font-semibold text-foreground">{result.referral_code}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="affiliate-link">Referral Link</Label>
                  <Input id="affiliate-link" value={referralLink} readOnly />
                </div>
                <Button variant="outline" className="w-full" type="button" onClick={copyReferralLink}>
                  Copy Referral Link
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Already have an account? <Link to="/auth" className="text-primary hover:underline">Go to login</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
