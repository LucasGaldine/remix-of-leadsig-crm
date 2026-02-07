import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Wrench,
  X,
} from "lucide-react";
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
}

interface EstimateData {
  total: number;
  subtotal: number;
  tax_rate: number;
  tax: number;
  discount: number;
  notes?: string;
  status: string;
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

export interface PortalData {
  job: JobData;
  company: CompanyData;
  schedules: ScheduleItem[];
  estimate: EstimateData | null;
  photos: { before: PhotoItem[]; after: PhotoItem[] };
  activity: ActivityItem[];
}

type PageState = "loading" | "loaded" | "error";

export default function ClientJobPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<PortalData | null>(null);
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
    fetchJobData();
  }, [token]);

  const fetchJobData = async () => {
    try {
      const response = await fetch(`${apiUrl}?token=${token}`, {
        headers: apiHeaders,
      });

      if (!response.ok) {
        const result = await response.json();
        setErrorMessage(result.error || "Could not load job details.");
        setPageState("error");
        return;
      }

      const result = await response.json();
      setData(result);
      setPageState("loaded");
    } catch {
      setErrorMessage("Unable to connect. Please try again later.");
      setPageState("error");
    }
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

  if (!data) return null;

  const { job, company, schedules, estimate, photos, activity } = data;

  const statusLabel = getStatusLabel(job.status, schedules);
  const statusColor = getStatusColor(job.status, schedules);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        <ClientPortalHeader
          job={job}
          company={company}
          estimate={estimate}
          statusLabel={statusLabel}
          statusColor={statusColor}
        />

        {schedules.length > 0 && (
          <ClientPortalSchedule schedules={schedules} />
        )}

        {estimate && (
          <ClientPortalEstimate
            estimate={estimate}
            token={token!}
            apiUrl={apiUrl}
            apiHeaders={apiHeaders}
            onRefresh={fetchJobData}
          />
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
