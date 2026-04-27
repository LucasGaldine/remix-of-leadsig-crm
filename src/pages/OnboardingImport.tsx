import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Database, HardHat, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CSVImportModal } from "@/components/leads/CSVImportModal";
import { CustomerCSVImportModal } from "@/components/customers/CustomerCSVImportModal";
import { JobCSVImportModal } from "@/components/jobs/JobCSVImportModal";
import { completeOnboardingImport } from "@/lib/onboarding";

type ImportView = "intro" | "imports";

export default function OnboardingImport() {
  const navigate = useNavigate();
  const [view, setView] = useState<ImportView>("intro");

  const [showLeadImport, setShowLeadImport] = useState(false);
  const [showClientImport, setShowClientImport] = useState(false);
  const [showJobImport, setShowJobImport] = useState(false);

  const [leadImportDone, setLeadImportDone] = useState(false);
  const [clientImportDone, setClientImportDone] = useState(false);
  const [jobImportDone, setJobImportDone] = useState(false);

  const continueToTutorial = () => {
    completeOnboardingImport();
    navigate("/tutorial");
  };

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
          <div className="text-sm font-medium text-muted-foreground">Step 3 of 3</div>
          <div className="grid grid-cols-3 gap-2" aria-hidden>
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-primary" />
          </div>
        </div>

        {view === "intro" ? (
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl">Bring your current data into LeadSig</CardTitle>
              <CardDescription className="text-base">
                Import now if you already have CSV files for leads, clients, or jobs. You can always do this later from each section.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-row gap-3 sm:items-center">
              <Button className="flex-1 sm:flex-none" variant="outline" onClick={continueToTutorial}>Skip for now</Button>
              <Button className="flex-1 sm:flex-none" onClick={() => setView("imports")}>Import now</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Database className="h-5 w-5" />
                  </div>
                  <CardTitle>Import Leads</CardTitle>
                  <CardDescription>
                    Use this for inbound requests or prospects that are not yet confirmed customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="secondary" onClick={() => setShowLeadImport(true)}>Import Leads CSV</Button>
                  {leadImportDone && (
                    <p className="flex items-center gap-2 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Leads imported
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <CardTitle>Import Clients</CardTitle>
                  <CardDescription>
                    Use this for your customer contact list with names, phone numbers, emails, and addresses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="secondary" onClick={() => setShowClientImport(true)}>Import Clients CSV</Button>
                  {clientImportDone && (
                    <p className="flex items-center gap-2 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Clients imported
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <HardHat className="h-5 w-5" />
                  </div>
                  <CardTitle>Import Jobs</CardTitle>
                  <CardDescription>
                    Use this for job records tied to customers, including service type, address, and scope details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="secondary" onClick={() => setShowJobImport(true)}>Import Jobs CSV</Button>
                  {jobImportDone && (
                    <p className="flex items-center gap-2 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Jobs imported
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={continueToTutorial}>
                Continue to tutorial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </main>

      <CSVImportModal
        open={showLeadImport}
        onOpenChange={setShowLeadImport}
        onImportComplete={() => {
          setLeadImportDone(true);
        }}
      />

      <CustomerCSVImportModal
        open={showClientImport}
        onOpenChange={setShowClientImport}
        onImportComplete={() => {
          setClientImportDone(true);
        }}
      />

      <JobCSVImportModal
        open={showJobImport}
        onOpenChange={setShowJobImport}
        onImportComplete={() => {
          setJobImportDone(true);
        }}
      />
    </div>
  );
}
