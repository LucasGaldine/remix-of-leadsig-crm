import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CircleAlert as AlertCircle, Building2, Calendar, Camera, CircleCheck as CheckCircle2, Clock, DollarSign, FileText, MapPin, Wrench, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ClientPortalHeader } from "@/components/client-portal/ClientPortalHeader";
import { ClientPortalEstimate } from "@/components/client-portal/ClientPortalEstimate";
import { ClientPortalPhotos } from "@/components/client-portal/ClientPortalPhotos";
import { ClientPortalSchedule } from "@/components/client-portal/ClientPortalSchedule";
import { ClientPortalActivity } from "@/components/client-portal/ClientPortalActivity";

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

interface CustomerData {
  name: string;
  email?: string;
  phone?: string;
}

interface CompanyData {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  logo_url?: string;
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
  changed_at?: string;
}

interface EstimateData {
  total: number;
  subtotal: number;
  tax_rate: number;
  tax: number;
  discount: number;
  notes?: string;
  status: string;
  updated_at: string;
  line_items: LineItem[];
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

export interface PortalData {
  job: JobData;
  company: CompanyData;
  schedules: ScheduleItem[];
  estimate_visit_schedules: ScheduleItem[];
  estimate: EstimateData | null;
  invoice: InvoiceData | null;
  photos: { before: PhotoItem[]; after: PhotoItem[] };
  activity: ActivityItem[];
}

export interface CustomerPortalData {
  customer: CustomerData;
  company: CompanyData;
  jobs: JobListItem[];
  recurring_jobs: RecurringJobListItem[];
}

type PageState = "loading" | "loaded" | "error";
type ViewMode = "job-list" | "job-detail";

export default function ClientJobPortal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const jobId = searchParams.get("jobId");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [viewMode, setViewMode] = useState<ViewMode>("job-detail");
  const [data, setData] = useState<PortalData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerPortalData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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

  const fetchData = async () => {
    setPageState("loading");
    try {
      const url = jobId
        ? `${apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiUrl}?token=${token}`;

      const response = await fetch(url, {
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
    setSearchParams({ token: token!, jobId: selectedJobId });
  };

  const handleBackToList = () => {
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 sm:px-8 py-6 border-b border-slate-100">
              {customerData.company.logo_url && (
                <img
                  src={customerData.company.logo_url}
                  alt={customerData.company.company_name || "Company Logo"}
                  className="h-12 mb-4"
                />
              )}
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome, {customerData.customer.name}
              </h1>
              <p className="text-slate-600 mt-1">View your jobs and project details</p>
            </div>
          </div>

          {customerData.jobs.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Your Jobs</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {customerData.jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job.id)}
                    className="w-full px-6 sm:px-8 py-5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{job.name}</h3>
                        {job.address && (
                          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.address}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {job.service_type && (
                            <span className="text-xs text-slate-500 capitalize">
                              {job.service_type.replace(/_/g, " ")}
                            </span>
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
                        <h3 className="font-semibold text-slate-900 truncate">{rj.name}</h3>
                        {rj.address && (
                          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {rj.address}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-500 capitalize">
                            {rj.frequency} service
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

          {customerData.company.company_name && (
            <p className="text-center text-sm text-slate-400 pt-2 pb-4">
              Powered by {customerData.company.company_name}
              {customerData.company.company_phone && (
                <>
                  {" -- "}
                  <a href={`tel:${customerData.company.company_phone}`} className="hover:text-slate-600 transition-colors">
                    {customerData.company.company_phone}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { job, company, schedules, estimate_visit_schedules, estimate, invoice, photos, activity } = data;

  const statusLabel = getStatusLabel(job.status, schedules);
  const statusColor = getStatusColor(job.status, schedules);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {customerData && (
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
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
        />

        {(schedules.length > 0 || estimate_visit_schedules?.length > 0) && (
          <ClientPortalSchedule
            schedules={schedules}
            estimateVisitSchedules={estimate_visit_schedules}
          />
        )}

        {estimate && (
          <ClientPortalEstimate
            estimate={estimate}
            token={token!}
            apiUrl={apiUrl}
            apiHeaders={apiHeaders}
            onRefresh={fetchJobData}
            customerName={job.customer?.name || ""}
            jobName={job.name}
            address={job.address}
            companyName={company.company_name}
            companyEmail={company.company_email}
            companyPhone={company.company_phone}
            createdAt={job.created_at}
          />
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
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl bg-slate-800 text-white font-medium text-sm hover:bg-slate-900 transition-colors"
              >
                <DollarSign className="h-4 w-4" />
                {invoice.status === "paid" ? "View Receipt" : "Pay Invoice"}
              </a>
            </div>
          </div>
        )}

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
                  {company.company_phone}
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
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
