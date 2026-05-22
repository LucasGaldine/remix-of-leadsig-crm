import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CircleAlert as AlertCircle, Building2, Calendar, Camera, CircleCheck as CheckCircle2, Clock, DollarSign, FileText, Wrench, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ClientPortalHeader } from "@/components/client-portal/ClientPortalHeader";
import { ClientPortalEstimate } from "@/components/client-portal/ClientPortalEstimate";
import { ClientPortalJobRelease } from "@/components/client-portal/ClientPortalJobRelease";
import { ClientPortalPhotos } from "@/components/client-portal/ClientPortalPhotos";
import { ClientPortalSchedule } from "@/components/client-portal/ClientPortalSchedule";
import { ClientPortalActivity } from "@/components/client-portal/ClientPortalActivity";
import { ClientPortalReviewRequestCard } from "@/components/client-portal/ClientPortalReviewRequestCard";
import { shouldShowReviewRequestCard } from "@/lib/jobCompletionReview";
import {
  darkenHexColor,
  hexToRgba,
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";
import { getBrandFontOption, loadGoogleBrandFont } from "@/lib/brandFonts";

interface JobData {
  name: string;
  address?: string;
  service_type?: string;
  status: string;
  description?: string;
  created_at: string;
  customer: { name: string; email?: string; phone?: string } | null;
}

interface JobListItem {
  id: string;
  name: string;
  address?: string;
  service_type?: string;
  status: string;
  created_at: string;
}

interface RecurringJobListItem {
  id: string;
  name: string;
  address?: string;
  service_type?: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  created_at: string;
}

interface InvoiceListItem {
  id: string;
  lead_id: string;
  job_name: string;
  service_type?: string;
  stripe_invoice_url: string;
  status: string;
  total: number;
  created_at: string;
}

interface CustomerData {
  name: string;
  email?: string;
  phone?: string;
}

interface CompanyData {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  website?: string;
  logo_url?: string;
  portal_color?: string | null;
  portal_text_color?: string | null;
  client_portal_color?: string | null;
  client_portal_text_color?: string | null;
  settings?: {
    client_portal_color?: string | null;
    client_portal_text_color?: string | null;
    website?: {
      font?: string | null;
      body_font?: string | null;
    } | null;
  } | null;
}

interface ScheduleItem {
  scheduled_date: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  is_completed: boolean;
}

interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  is_change_order?: boolean;
  change_order_type?: 'added' | 'edited' | 'deleted';
  change_order_approved?: boolean | null;
  changed_at?: string;
}

interface EstimateData {
  id?: string;
  job_id?: string | null;
  total: number;
  subtotal: number;
  profit_margin?: number;
  tax_rate: number;
  tax: number;
  discount: number;
  notes?: string;
  status: string;
  updated_at: string;
  line_items: LineItem[];
  original_total?: number | null;
  original_subtotal?: number | null;
  original_tax?: number | null;
  original_discount?: number | null;
  original_notes?: string | null;
  original_line_items?: LineItem[] | null;
  has_pending_changes?: boolean;
  estimate_versions?: Array<{
    id: string;
    name: string;
    subtotal: number;
    tax_rate: number;
    tax: number;
    discount: number;
    total: number;
    profit_margin?: number;
    notes?: string | null;
    line_items: LineItem[];
  }>;
  proposal_settings?: {
    sections?: Record<string, boolean>;
    title?: string | null;
    team_member_ids?: string[];
    highlight_line_item_ids?: string[];
  } | null;
  project_visualization_image_url?: string | null;
  agreement_templates?: Record<string, unknown> | null;
  agreement_acceptance?: Record<string, unknown> | null;
  agreement_source_estimate_id?: string | null;
  job_document_config_lead_id?: string | null;
  job_document_configs?: Array<{
    id: string;
    lead_id: string;
    template_id: string;
    include_in_job: boolean;
    email_timing: string;
    requires_signature: boolean;
    sort_order: number;
    template: {
      id: string;
      name: string;
      system_key: string | null;
      body: string | null;
    } | null;
  }>;
  job_documents?: Array<{
    id: string;
    lead_id: string;
    template_id: string | null;
    config_id: string | null;
    document_key: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    created_at: string;
    url: string;
  }>;
}

interface PhotoItem {
  id: string;
  url: string;
  created_at: string;
}

interface ActivityItem {
  type: string;
  summary?: string;
  created_at: string;
}

interface InvoiceData {
  stripe_invoice_url: string | null;
  status: string;
}

interface PortalMetadata {
  customer: CustomerData;
  has_portal: boolean;
}

export interface PortalData {
  job: JobData;
  company: CompanyData;
  schedules: ScheduleItem[];
  estimate_visit_schedules: ScheduleItem[];
  estimate: EstimateData | null;
  invoice: InvoiceData | null;
  job_release?: {
    id: string;
    status: string;
    release_text: string;
    signed_at?: string | null;
    signature_image_url?: string | null;
    requested_at?: string | null;
  } | null;
  is_fully_paid?: boolean;
  photos: { before: PhotoItem[]; after: PhotoItem[] };
  activity: ActivityItem[];
  portal_metadata?: PortalMetadata;
}

export interface ClientPortalData {
  customer: CustomerData;
  company: CompanyData;
  jobs: JobListItem[];
  recurring_jobs: RecurringJobListItem[];
  invoices: InvoiceListItem[];
}

type PageState = "loading" | "loaded" | "error";
type ViewMode = "job-list" | "job-detail";
const DEFAULT_FAVICON = "/logo.png";

function setDocumentFavicon(href: string) {
  const iconLink = document.querySelector("link[rel='icon']") ?? document.createElement("link");
  iconLink.setAttribute("rel", "icon");
  iconLink.setAttribute("href", href);
  if (!iconLink.parentNode) {
    document.head.appendChild(iconLink);
  }

  const appleTouchIconLink =
    document.querySelector("link[rel='apple-touch-icon']") ?? document.createElement("link");
  appleTouchIconLink.setAttribute("rel", "apple-touch-icon");
  appleTouchIconLink.setAttribute("href", href);
  if (!appleTouchIconLink.parentNode) {
    document.head.appendChild(appleTouchIconLink);
  }
}

export default function ClientJobPortal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const jobId = searchParams.get("jobId");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [viewMode, setViewMode] = useState<ViewMode>("job-detail");
  const [data, setData] = useState<PortalData | null>(null);
  const [customerData, setCustomerData] = useState<ClientPortalData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewCardDismissed, setReviewCardDismissed] = useState(false);
  const customerName =
    customerData?.customer?.name?.trim() ||
    data?.job?.customer?.name?.trim() ||
    data?.portal_metadata?.customer?.name?.trim() ||
    "";
  const portalTabTitle = customerName ? `${customerName} | Client Portal` : "Client Portal";
  const activeCompany = customerData?.company ?? data?.company;
  const headingFontOption = getBrandFontOption(activeCompany?.settings?.website?.font);
  const bodyFontOption = getBrandFontOption(activeCompany?.settings?.website?.body_font);
  const currentProjects = customerData?.jobs.filter((job) => !isPastProjectStatus(job.status)) ?? [];
  const pastProjects = customerData?.jobs.filter((job) => isPastProjectStatus(job.status)) ?? [];

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-client-portal`;
  const apiHeaders = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };

  useEffect(() => {
    if (!token) {
      setErrorMessage("No share token provided. Please check the link you were sent.");
      setPageState("error");
      return;
    }
    fetchData();
  }, [token, jobId]);

  useEffect(() => {
    const logoUrl = customerData?.company.logo_url ?? data?.company.logo_url ?? DEFAULT_FAVICON;
    setDocumentFavicon(logoUrl || DEFAULT_FAVICON);

    return () => {
      setDocumentFavicon(DEFAULT_FAVICON);
    };
  }, [customerData?.company.logo_url, data?.company.logo_url]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = portalTabTitle;

    return () => {
      document.title = previousTitle;
    };
  }, [portalTabTitle]);

  useEffect(() => { loadGoogleBrandFont(headingFontOption); }, [headingFontOption]);
  useEffect(() => { loadGoogleBrandFont(bodyFontOption); }, [bodyFontOption]);

  const fetchData = async () => {
    setPageState("loading");
    try {
      const url = jobId
        ? `${apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiUrl}?token=${token}`;

      const response = await fetch(url, {
        cache: "no-store",
        headers: apiHeaders,
      });

      if (!response.ok) {
        const result = await response.json();
        setErrorMessage(result.error || "Could not load data.");
        setPageState("error");
        return;
      }

      const result = await response.json();

      if (result.jobs !== undefined) {
        setCustomerData(result);
        setViewMode("job-list");
        setData(null);
      } else {
        setData(result);
        setViewMode("job-detail");
      }

      setPageState("loaded");
    } catch {
      setErrorMessage("Unable to connect. Please try again later.");
      setPageState("error");
    }
  };

  const handleSelectJob = (selectedJobId: string) => {
    setReviewCardDismissed(false);
    setSearchParams({ token: token!, jobId: selectedJobId });
  };

  const handleBackToList = () => {
    setReviewCardDismissed(false);
    setSearchParams({ token: token! });
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-600">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (viewMode === "job-list" && customerData) {
    const customerPortalColor = normalizeClientPortalColor(
      customerData.company.portal_color ??
        customerData.company.client_portal_color ??
        customerData.company.settings?.client_portal_color,
    );
    const customerPortalTextColor = normalizeClientPortalTextColor(
      customerData.company.portal_text_color ??
        customerData.company.client_portal_text_color ??
        customerData.company.settings?.client_portal_text_color,
    );
    const customerPortalThemeStyle = {
      "--client-portal-color": customerPortalColor,
      "--client-portal-color-dark": darkenHexColor(customerPortalColor, 0.16),
      "--client-portal-text-color": customerPortalTextColor,
      "--client-portal-text-muted": hexToRgba(customerPortalTextColor, 0.72),
      "--client-portal-text-subtle": hexToRgba(customerPortalTextColor, 0.56),
      "--client-portal-heading-font": headingFontOption?.css,
      "--client-portal-body-font": bodyFontOption?.css,
    } as React.CSSProperties;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="client-portal-themed mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12 space-y-6" style={customerPortalThemeStyle}>
          <div
            className="bg-white rounded-2xl shadow-lg overflow-hidden border"
            style={{ borderColor: hexToRgba(customerPortalTextColor, 0.8) }}
          >
            <div
              className="px-6 sm:px-8 py-6"
              style={{
                backgroundColor: customerPortalColor,
              }}
            >
              {customerData.company.logo_url && (
                <img
                  src={customerData.company.logo_url}
                  alt={customerData.company.company_name || "Company Logo"}
                  className="h-12 mb-4"
                />
              )}
              {customerData.company.company_name && (
                <p className="text-sm font-medium mb-3" style={{ color: hexToRgba(customerPortalTextColor, 0.78) }}>
                  {customerData.company.company_name}
                </p>
              )}
              <h1 className="text-2xl font-bold" style={{ color: customerPortalTextColor }}>
                Welcome, {customerData.customer.name}
              </h1>
              <p className="mt-1" style={{ color: hexToRgba(customerPortalTextColor, 0.78) }}>
                View your jobs and project details
              </p>
              {(customerData.company.company_phone ||
                customerData.company.company_email ||
                customerData.company.company_address ||
                customerData.company.website) && (
                <div
                  className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                  style={{ color: hexToRgba(customerPortalTextColor, 0.82) }}
                >
                  {customerData.company.company_phone && (
                    <a
                      href={`tel:${customerData.company.company_phone}`}
                      className="hover:underline"
                    >
                      {formatPhoneNumber(customerData.company.company_phone)}
                    </a>
                  )}
                  {customerData.company.company_email && (
                    <a
                      href={`mailto:${customerData.company.company_email}`}
                      className="hover:underline"
                    >
                      {customerData.company.company_email}
                    </a>
                  )}
                  {customerData.company.company_address && (
                    <span>{customerData.company.company_address}</span>
                  )}
                  {customerData.company.website && (
                    <a
                      href={formatWebsiteUrl(customerData.company.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {customerData.company.website}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {customerData.invoices && customerData.invoices.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {customerData.invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="px-6 sm:px-8 py-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {invoice.service_type ? formatServiceType(invoice.service_type) : invoice.job_name}
                        </h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm text-slate-600">
                            ${Number(invoice.total).toFixed(2)}
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            invoice.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {invoice.status === "paid" ? "Paid" : "Payment Due"}
                          </span>
                        </div>
                      </div>
                      <a
                        href={invoice.stripe_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: customerPortalColor, color: customerPortalTextColor }}
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

          {customerData.jobs.length > 0 && (
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
                        onClick={() => handleSelectJob(job.id)}
                        className="w-full px-6 sm:px-8 py-5 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 truncate">
                              {job.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-2">
                              {job.service_type && (
                                <span className="text-sm text-slate-600">{formatServiceType(job.service_type)}</span>
                              )}
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                getStatusColor(job.status, [])
                              )}>
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
                        onClick={() => handleSelectJob(job.id)}
                        className="w-full px-6 sm:px-8 py-5 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 truncate">
                              {job.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-2">
                              {job.service_type && (
                                <span className="text-sm text-slate-600">{formatServiceType(job.service_type)}</span>
                              )}
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                getStatusColor(job.status, [])
                              )}>
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

          {customerData.recurring_jobs.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Recurring Services</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {customerData.recurring_jobs.map((rj) => (
                  <button
                    key={rj.id}
                    onClick={() => handleSelectJob(rj.id)}
                    className="w-full px-6 sm:px-8 py-5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {rj.service_type ? formatServiceType(rj.service_type) : rj.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm text-slate-600">{rj.name}</span>
                          <span className="text-xs text-slate-500 capitalize">
                            {rj.frequency}
                          </span>
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

          {customerData.jobs.length === 0 && customerData.recurring_jobs.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-slate-600">No jobs found</p>
            </div>
          )}

        </div>
      </div>
    );
  }

  if (!data) return null;

  const { job, company, schedules, estimate_visit_schedules, estimate, invoice, photos, activity } = data;

  const statusLabel = getStatusLabel(job.status, schedules);
  const statusColor = getStatusColor(job.status, schedules);
  const shouldRenderReviewRequestCard = shouldShowReviewRequestCard(statusLabel, reviewCardDismissed);

  const showBackButton = customerData || data?.portal_metadata?.has_portal;
  const portalColor = normalizeClientPortalColor(
    company.portal_color ?? company.client_portal_color ?? company.settings?.client_portal_color,
  );
  const portalColorDark = darkenHexColor(portalColor, 0.16);
  const portalTextColor = normalizeClientPortalTextColor(
    company.portal_text_color ?? company.client_portal_text_color ?? company.settings?.client_portal_text_color,
  );
  const portalThemeStyle = {
    "--client-portal-color": portalColor,
    "--client-portal-color-dark": portalColorDark,
    "--client-portal-text-color": portalTextColor,
    "--client-portal-text-muted": hexToRgba(portalTextColor, 0.72),
    "--client-portal-text-subtle": hexToRgba(portalTextColor, 0.56),
    "--client-portal-heading-font": headingFontOption?.css,
    "--client-portal-body-font": bodyFontOption?.css,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="client-portal-themed mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12 space-y-6" style={portalThemeStyle}>
        {showBackButton && (
          <button
            onClick={handleBackToList}
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
          portalColor={portalColor}
          portalTextColor={portalTextColor}
        />

        {shouldRenderReviewRequestCard && (
          <ClientPortalReviewRequestCard
            onLeaveReview={() => undefined}
            onDismiss={() => setReviewCardDismissed(true)}
          />
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
            token={token!}
            apiUrl={apiUrl}
            apiHeaders={apiHeaders}
            onRefresh={fetchData}
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
                ? ((company.settings as Record<string, unknown>).default_payment_schedule as Record<string, unknown> | null)
                : null
            }
            createdAt={job.created_at}
            portalColor={portalColor}
            portalTextColor={portalTextColor}
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
                style={{ backgroundColor: portalColor, color: portalTextColor }}
              >
                <DollarSign className="h-4 w-4" />
                {invoice.status === "paid" ? "View Receipt" : "Pay Invoice"}
              </a>
            </div>
          </div>
        )}

        <ClientPortalJobRelease
          token={token!}
          jobId={jobId}
          apiUrl={apiUrl}
          apiHeaders={apiHeaders}
          isFullyPaid={data?.is_fully_paid === true}
          jobRelease={data?.job_release || null}
          onSigned={fetchData}
        />

        {(photos.before.length > 0 || photos.after.length > 0) && (
          <ClientPortalPhotos photos={photos} />
        )}

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

function formatServiceType(serviceType: string): string {
  return serviceType
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getStatusLabel(status: string, schedules: ScheduleItem[]): string {
  if (status === "paid") return "Paid";
  if (status === "completed") return "Completed";
  if (status === "job" && schedules.length > 0) {
    const now = new Date();
    const sorted = [...schedules].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    const last = sorted[sorted.length - 1];
    const lastEnd = new Date(`${last.scheduled_date}T${last.scheduled_time_end || "23:59:59"}`);
    const first = sorted[0];
    const firstStart = new Date(`${first.scheduled_date}T${first.scheduled_time_start || "00:00:00"}`);

    if (now > lastEnd) return "Completed";
    if (now >= firstStart) return "In Progress";
    return "Scheduled";
  }
  return "Pending";
}

function getStatusColor(status: string, schedules: ScheduleItem[]): string {
  const label = getStatusLabel(status, schedules);
  switch (label) {
    case "Paid":
      return "bg-emerald-100 text-emerald-800";
    case "Completed":
      return "bg-blue-100 text-blue-800";
    case "In Progress":
      return "bg-amber-100 text-amber-800";
    case "Scheduled":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function isPastProjectStatus(status: string): boolean {
  return status === "completed" || status === "paid";
}

function formatWebsiteUrl(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
