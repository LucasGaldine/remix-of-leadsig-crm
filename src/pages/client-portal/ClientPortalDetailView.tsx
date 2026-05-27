import { ChevronRight, DollarSign, FileText } from "lucide-react";

import { ClientPortalActivity } from "@/components/client-portal/ClientPortalActivity";
import { ClientPortalEstimate } from "@/components/client-portal/ClientPortalEstimate";
import { ClientPortalHeader } from "@/components/client-portal/ClientPortalHeader";
import { ClientPortalJobRelease } from "@/components/client-portal/ClientPortalJobRelease";
import { ClientPortalPhotos } from "@/components/client-portal/ClientPortalPhotos";
import { ClientPortalReviewRequestCard } from "@/components/client-portal/ClientPortalReviewRequestCard";
import { ClientPortalSchedule } from "@/components/client-portal/ClientPortalSchedule";
import { shouldShowReviewRequestCard } from "@/lib/jobCompletionReview";

import type { ClientPortalDetailViewProps } from "./internalTypes";
import {
  buildClientPortalThemeStyle,
  resolveClientPortalPalette,
} from "./presentation";
import { formatPhoneNumber, getStatusColor, getStatusLabel } from "./utils";

export function ClientPortalDetailView({
  data,
  customerData,
  token,
  jobId,
  apiConfig,
  headingFontOption,
  bodyFontOption,
  reviewCardDismissed,
  onDismissReviewCard,
  onBackToList,
  onRefresh,
}: ClientPortalDetailViewProps) {
  const { job, schedules, estimate_visit_schedules, estimate, invoice, photos, activity } = data;
  const company = data.company ?? {};

  const statusLabel = getStatusLabel(job.status, schedules);
  const statusColor = getStatusColor(job.status, schedules);
  const shouldRenderReviewRequestCard = shouldShowReviewRequestCard(statusLabel, reviewCardDismissed);

  const showBackButton = Boolean(customerData || data.portal_metadata?.has_portal);
  const palette = resolveClientPortalPalette(company);
  const portalThemeStyle = buildClientPortalThemeStyle({
    palette,
    headingFontCss: headingFontOption?.css,
    bodyFontCss: bodyFontOption?.css,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div
        className="client-portal-themed mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12 space-y-6"
        style={portalThemeStyle}
      >
        {showBackButton && (
          <button
            onClick={onBackToList}
            className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to all jobs
          </button>
        )}

        <ClientPortalHeader
          job={job}
          company={company}
          estimate={estimate}
          statusLabel={statusLabel}
          statusColor={statusColor}
          portalColor={palette.portalColor}
          portalTextColor={palette.portalTextColor}
        />

        {shouldRenderReviewRequestCard && (
          <ClientPortalReviewRequestCard onLeaveReview={() => undefined} onDismiss={onDismissReviewCard} />
        )}

        {(schedules.length > 0 || estimate_visit_schedules?.length > 0) && (
          <ClientPortalSchedule
            schedules={schedules}
            estimateVisitSchedules={estimate_visit_schedules}
          />
        )}

        {estimate ? (
          <ClientPortalEstimate
            estimate={estimate}
            token={token}
            apiUrl={apiConfig.apiUrl}
            apiHeaders={apiConfig.apiHeaders}
            onRefresh={onRefresh}
            jobId={jobId}
            customerName={job.customer?.name || ""}
            jobName={job.name}
            address={job.address}
            companyName={company.company_name}
            companyLogoUrl={company.logo_url}
            companyEmail={company.company_email}
            companyPhone={company.company_phone}
            companyDefaultPaymentSchedule={
              company.settings && typeof company.settings === "object"
                ? ((company.settings as Record<string, unknown>).default_payment_schedule as
                    | Record<string, unknown>
                    | null)
                : null
            }
            createdAt={job.created_at}
            portalColor={palette.portalColor}
            portalTextColor={palette.portalTextColor}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900">Estimate</h2>
              </div>
            </div>
            <div className="px-6 sm:px-8 py-6">
              <p className="text-sm text-slate-600">No estimate has been created for this job yet.</p>
            </div>
          </div>
        )}

        {invoice?.stripe_invoice_url && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900">Invoice</h2>
                {invoice.status === "paid" ? (
                  <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Paid
                  </span>
                ) : (
                  <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    Payment Due
                  </span>
                )}
              </div>
            </div>
            <div className="px-6 sm:px-8 py-5">
              <a
                href={invoice.stripe_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: palette.portalColor, color: palette.portalTextColor }}
              >
                <DollarSign className="h-4 w-4" />
                {invoice.status === "paid" ? "View Receipt" : "Pay Invoice"}
              </a>
            </div>
          </div>
        )}

        <ClientPortalJobRelease
          token={token}
          jobId={jobId}
          apiUrl={apiConfig.apiUrl}
          apiHeaders={apiConfig.apiHeaders}
          isFullyPaid={data.is_fully_paid === true}
          jobRelease={data.job_release || null}
          onSigned={onRefresh}
        />

        {(photos.before.length > 0 || photos.after.length > 0) && <ClientPortalPhotos photos={photos} />}

        {activity.length > 0 && <ClientPortalActivity activity={activity} />}

        {company.company_name && (
          <p className="text-center text-sm text-slate-400 pt-2 pb-4">
            Powered by {company.company_name}
            {company.company_phone && (
              <>
                {" -- "}
                <a href={`tel:${company.company_phone}`} className="hover:text-slate-600 transition-colors">
                  {formatPhoneNumber(company.company_phone)}
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
