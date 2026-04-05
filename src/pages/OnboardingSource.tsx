import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { completeOnboardingSource, getOnboardingPreviousCrm, saveOnboardingPreviousCrm } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type PreviousCrmChoice = "jobber" | "housecall-pro" | "servicetitan" | "spreadsheet" | "other";
type SourceView = "selection" | "comparison";

const previousCrmChoices: { id: PreviousCrmChoice; label: string }[] = [
  { id: "jobber", label: "Jobber" },
  { id: "housecall-pro", label: "Housecall Pro" },
  { id: "servicetitan", label: "ServiceTitan" },
  { id: "spreadsheet", label: "Excel / Sheets" },
  { id: "other", label: "Other" },
];

function resolveComparisonCrmName(storedCrmName: string | null) {
  const storedValue = storedCrmName?.trim();
  if (!storedValue) {
    return "your previous CRM";
  }

  const knownCrm = previousCrmChoices.find((crm) => crm.label.toLowerCase() === storedValue.toLowerCase());
  return knownCrm?.label ?? storedValue;
}

export default function OnboardingSource() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReplay = searchParams.get("source") === "search";

  const initialPreviousCrm = getOnboardingPreviousCrm();
  const initialChoice =
    previousCrmChoices.find((crm) => crm.label === initialPreviousCrm)?.id ?? (initialPreviousCrm ? "other" : null);

  const [selectedPreviousCrm, setSelectedPreviousCrm] = useState<PreviousCrmChoice | null>(initialChoice);
  const [customPreviousCrm, setCustomPreviousCrm] = useState(initialChoice === "other" ? initialPreviousCrm ?? "" : "");
  const [view, setView] = useState<SourceView>("selection");

  const persistPreviousCrm = (crmName: string) => {
    saveOnboardingPreviousCrm(crmName);
  };

  const handleSelectPreviousCrm = (choice: PreviousCrmChoice) => {
    setSelectedPreviousCrm(choice);
    if (choice !== "other") {
      const crmName = previousCrmChoices.find((crm) => crm.id === choice)?.label;
      if (crmName) {
        persistPreviousCrm(crmName);
      }
    }
  };

  const continueToComparisonStep = () => {
    if (selectedPreviousCrm === "other" && customPreviousCrm.trim()) {
      persistPreviousCrm(customPreviousCrm);
    }
    setView("comparison");
  };

  const continueToImportStep = () => {
    if (selectedPreviousCrm === "other" && customPreviousCrm.trim()) {
      persistPreviousCrm(customPreviousCrm);
    }

    completeOnboardingSource();
    navigate(isReplay ? "/onboarding/import?source=search" : "/onboarding/import");
  };

  const comparisonCrmName = resolveComparisonCrmName(getOnboardingPreviousCrm());

  return (
    <div className="min-h-screen bg-surface-sunken pb-10">
      <PageHeader
        title="Tell Us Your Current CRM"
        subtitle={isReplay ? "Replay your CRM setup anytime" : "Step 1 of 2 before importing your data"}
        showNotifications={false}
        showSearch={false}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Step 1 of 2</div>
          <div className="grid grid-cols-2 gap-2" aria-hidden>
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-muted" />
          </div>
        </div>

        {view === "selection" ? (
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl">Which CRM did you come from?</CardTitle>
              <CardDescription className="text-base">
                Pick your previous system so we can tailor your onboarding experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {previousCrmChoices.map((crm) => (
                  <Button
                    key={crm.id}
                    type="button"
                    variant="outline"
                    className={cn(
                      "justify-start border-border/70 hover:bg-muted/40",
                      selectedPreviousCrm === crm.id && "border-primary bg-primary/10 text-primary",
                    )}
                    onClick={() => handleSelectPreviousCrm(crm.id)}
                  >
                    {crm.label}
                  </Button>
                ))}
              </div>

              {selectedPreviousCrm === "other" && (
                <div className="space-y-2">
                  <label htmlFor="previous-crm-other" className="text-sm font-medium text-foreground">
                    Previous CRM name
                  </label>
                  <Input
                    id="previous-crm-other"
                    type="text"
                    placeholder="Type CRM name"
                    value={customPreviousCrm}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomPreviousCrm(value);
                      if (value.trim().length > 0) {
                        persistPreviousCrm(value);
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={continueToComparisonStep}>
                  Continue to comparison
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-8 sm:pt-10">
              <div className="crm-win-animation" aria-live="polite">
                <p className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
                  LeadSig is already outrunning {comparisonCrmName}
                </p>
                <p className="mt-2 text-center text-sm text-muted-foreground sm:text-base">
                  Faster lead response, tighter follow-up, and cleaner job handoff.
                </p>

                <div
                  role="group"
                  aria-label="CRM performance comparison"
                  aria-orientation="vertical"
                  className="mt-10 flex justify-center gap-10 sm:gap-14"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-40 w-20 items-end rounded-2xl bg-primary/15 p-2 sm:h-48">
                      <div className="crm-race-bar crm-race-bar--leadsig w-full rounded-xl bg-primary" />
                    </div>
                    <span className="text-xs font-semibold">LeadSig</span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-40 w-20 items-end rounded-2xl bg-muted p-2 sm:h-48">
                      <div className="crm-race-bar crm-race-bar--previous w-full rounded-xl bg-muted-foreground/40" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{comparisonCrmName}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setView("selection")}>
                  Back
                </Button>
                <Button onClick={continueToImportStep}>
                  Continue to import step
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
