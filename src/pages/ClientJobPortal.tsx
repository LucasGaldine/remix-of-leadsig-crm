import { CircleAlert as AlertCircle } from "lucide-react";

import { ClientPortalDetailView } from "./client-portal/ClientPortalDetailView";
import { ClientPortalListView } from "./client-portal/ClientPortalListView";
import { useClientPortalController } from "./client-portal/useClientPortalController";
import { useClientPortalDocumentEffects } from "./client-portal/useClientPortalDocumentEffects";

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-slate-600 border-t-transparent rounded-full" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-slate-600">{message}</p>
      </div>
    </div>
  );
}

export default function ClientJobPortal() {
  const controller = useClientPortalController();

  useClientPortalDocumentEffects({
    activeCompany: controller.activeCompany,
    portalTabTitle: controller.portalTabTitle,
    headingFontOption: controller.headingFontOption,
    bodyFontOption: controller.bodyFontOption,
  });

  if (controller.pageState === "loading") {
    return <LoadingState />;
  }

  if (controller.pageState === "error") {
    return <ErrorState message={controller.errorMessage} />;
  }

  if (controller.viewMode === "job-list" && controller.customerData) {
    return (
      <ClientPortalListView
        customerData={controller.customerData}
        customerJobs={controller.customerJobs}
        customerRecurringJobs={controller.customerRecurringJobs}
        customerInvoices={controller.customerInvoices}
        currentProjects={controller.currentProjects}
        pastProjects={controller.pastProjects}
        headingFontOption={controller.headingFontOption}
        bodyFontOption={controller.bodyFontOption}
        onSelectJob={controller.handleSelectJob}
      />
    );
  }

  if (!controller.data || !controller.token) {
    return null;
  }

  return (
    <ClientPortalDetailView
      data={controller.data}
      customerData={controller.customerData}
      token={controller.token}
      jobId={controller.jobId}
      apiConfig={controller.apiConfig}
      headingFontOption={controller.headingFontOption}
      bodyFontOption={controller.bodyFontOption}
      reviewCardDismissed={controller.reviewCardDismissed}
      onDismissReviewCard={controller.dismissReviewCard}
      onBackToList={controller.handleBackToList}
      onRefresh={controller.fetchData}
    />
  );
}
