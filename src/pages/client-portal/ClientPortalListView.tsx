import { ChevronRight, DollarSign } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ClientPortalListViewProps } from "./internalTypes";
import {
  buildClientPortalThemeStyle,
  getPortalTextColorWithOpacity,
  resolveClientPortalPalette,
  resolveCompanyContactDisplay,
} from "./presentation";
import { formatPhoneNumber, formatServiceType, formatWebsiteUrl, getStatusColor, getStatusLabel } from "./utils";

export function ClientPortalListView({
  customerData,
  customerJobs,
  customerRecurringJobs,
  customerInvoices,
  currentProjects,
  pastProjects,
  headingFontOption,
  bodyFontOption,
  onSelectJob,
}: ClientPortalListViewProps) {
  const customerCompany = customerData.company ?? {};
  const contactDisplay = resolveCompanyContactDisplay(customerCompany);
  const palette = resolveClientPortalPalette(customerCompany);
  const customerPortalThemeStyle = buildClientPortalThemeStyle({
    palette,
    headingFontCss: headingFontOption?.css,
    bodyFontCss: bodyFontOption?.css,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div
        className="client-portal-themed mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12 space-y-6"
        style={customerPortalThemeStyle}
      >
        <div
          className="bg-white rounded-2xl shadow-lg overflow-hidden border"
          style={{ borderColor: getPortalTextColorWithOpacity(palette.portalTextColor, 0.8) }}
        >
          <div
            className="px-6 sm:px-8 py-6"
            style={{
              backgroundColor: palette.portalColor,
            }}
          >
            {customerCompany.logo_url && (
              <img
                src={customerCompany.logo_url}
                alt={customerCompany.company_name || "Company Logo"}
                className="h-12 mb-4"
              />
            )}
            {customerCompany.company_name && (
              <p
                className="text-sm font-medium mb-3"
                style={{ color: getPortalTextColorWithOpacity(palette.portalTextColor, 0.78) }}
              >
                {customerCompany.company_name}
              </p>
            )}
            <h1 className="text-2xl font-bold" style={{ color: palette.portalTextColor }}>
              Welcome, {customerData.customer.name}
            </h1>
            <p className="mt-1" style={{ color: getPortalTextColorWithOpacity(palette.portalTextColor, 0.78) }}>
              View your jobs and project details
            </p>
            {contactDisplay.hasContactInfo && (
              <div
                className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                style={{ color: getPortalTextColorWithOpacity(palette.portalTextColor, 0.82) }}
              >
                {customerCompany.company_phone && (
                  <a href={`tel:${customerCompany.company_phone}`} className="hover:underline">
                    {formatPhoneNumber(customerCompany.company_phone)}
                  </a>
                )}
                {customerCompany.company_email && (
                  <a href={`mailto:${customerCompany.company_email}`} className="hover:underline">
                    {customerCompany.company_email}
                  </a>
                )}
                {customerCompany.company_address && <span>{customerCompany.company_address}</span>}
                {contactDisplay.website && (
                  <a
                    href={formatWebsiteUrl(contactDisplay.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {contactDisplay.website}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {customerInvoices.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {customerInvoices.map((invoice) => (
                <div key={invoice.id} className="px-6 sm:px-8 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {invoice.service_type ? formatServiceType(invoice.service_type) : invoice.job_name}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm text-slate-600">${Number(invoice.total).toFixed(2)}</span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            invoice.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800",
                          )}
                        >
                          {invoice.status === "paid" ? "Paid" : "Payment Due"}
                        </span>
                      </div>
                    </div>
                    <a
                      href={invoice.stripe_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                      style={{ backgroundColor: palette.portalColor, color: palette.portalTextColor }}
                    >
                      <DollarSign className="h-4 w-4" />
                      {invoice.status === "paid" ? "View" : "Pay"}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {customerJobs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {currentProjects.length > 0 && (
              <div>
                <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
                  <h2 className="text-lg font-semibold text-slate-900">Current Projects</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {currentProjects.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => onSelectJob(job.id)}
                      className="w-full px-6 sm:px-8 py-5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{job.name}</h3>
                          <div className="flex items-center gap-3 mt-2">
                            {job.service_type && (
                              <span className="text-sm text-slate-600">{formatServiceType(job.service_type)}</span>
                            )}
                            <span
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                getStatusColor(job.status, []),
                              )}
                            >
                              {getStatusLabel(job.status, [])}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 ml-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pastProjects.length > 0 && (
              <div>
                <div className="px-6 sm:px-8 py-5 border-y border-slate-100">
                  <h2 className="text-lg font-semibold text-slate-900">Your Past Projects</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {pastProjects.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => onSelectJob(job.id)}
                      className="w-full px-6 sm:px-8 py-5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{job.name}</h3>
                          <div className="flex items-center gap-3 mt-2">
                            {job.service_type && (
                              <span className="text-sm text-slate-600">{formatServiceType(job.service_type)}</span>
                            )}
                            <span
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                getStatusColor(job.status, []),
                              )}
                            >
                              {getStatusLabel(job.status, [])}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 ml-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {customerRecurringJobs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Recurring Services</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {customerRecurringJobs.map((rj) => (
                <button
                  key={rj.id}
                  onClick={() => onSelectJob(rj.id)}
                  className="w-full px-6 sm:px-8 py-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {rj.service_type ? formatServiceType(rj.service_type) : rj.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm text-slate-600">{rj.name}</span>
                        <span className="text-xs text-slate-500 capitalize">{rj.frequency}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-100 text-sky-800">
                          Recurring
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 ml-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {customerJobs.length === 0 && customerRecurringJobs.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-slate-600">No jobs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
