import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, FileText, AlertCircle, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort_order?: number;
}

interface EstimateData {
  id: string;
  subtotal: number;
  tax_rate: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  status: string;
  expires_at?: string;
  created_at: string;
  accepted_at?: string;
  approved_via?: string;
  customer: { name: string; email?: string; phone?: string } | null;
  job: { name: string; address?: string; service_type?: string } | null;
  line_items: LineItem[];
}

interface CompanyData {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  logo_url?: string;
}

type PageState = "loading" | "loaded" | "approved" | "already_approved" | "expired" | "error";

export default function EstimateApproval() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [company, setCompany] = useState<CompanyData>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [approving, setApproving] = useState(false);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-approve`;
  const apiHeaders = {
    "Content-Type": "application/json",
    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  useEffect(() => {
    if (!token) {
      setErrorMessage("No approval token provided. Please check the link you were sent.");
      setPageState("error");
      return;
    }
    fetchEstimate();
  }, [token]);

  const fetchEstimate = async () => {
    try {
      const response = await fetch(`${apiUrl}?token=${token}`, {
        headers: apiHeaders,
      });

      if (!response.ok) {
        const data = await response.json();
        setErrorMessage(data.error || "Could not load estimate.");
        setPageState("error");
        return;
      }

      const data = await response.json();
      setEstimate(data.estimate);
      setCompany(data.company || {});

      if (data.estimate.status === "accepted") {
        setPageState("already_approved");
      } else if (
        data.estimate.expires_at &&
        new Date(data.estimate.expires_at) < new Date()
      ) {
        setPageState("expired");
      } else {
        setPageState("loaded");
      }
    } catch {
      setErrorMessage("Unable to connect. Please try again later.");
      setPageState("error");
    }
  };

  const handleApprove = async () => {
    if (!token) return;
    setApproving(true);

    try {
      const response = await fetch(`${apiUrl}?token=${token}`, {
        method: "POST",
        headers: apiHeaders,
      });

      if (!response.ok) {
        const data = await response.json();
        setErrorMessage(data.error || "Failed to approve estimate.");
        setPageState("error");
        return;
      }

      setPageState("approved");
    } catch {
      setErrorMessage("Unable to connect. Please try again later.");
      setPageState("error");
    } finally {
      setApproving(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
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

  if (pageState === "approved") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5 ring-4 ring-emerald-100">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Estimate Approved</h1>
          <p className="text-slate-600 mb-6">
            Thank you! Your approval has been recorded.
            {company.company_name && ` ${company.company_name} will be in touch soon.`}
          </p>
          {estimate && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">Approved total</p>
              <p className="text-3xl font-bold text-slate-900">
                ${Number(estimate.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (pageState === "already_approved") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Already Approved</h1>
          <p className="text-slate-600">
            This estimate was approved
            {estimate?.accepted_at && ` on ${format(new Date(estimate.accepted_at), "MMMM d, yyyy")}`}.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Estimate Expired</h1>
          <p className="text-slate-600">
            This estimate expired
            {estimate?.expires_at && ` on ${format(new Date(estimate.expires_at), "MMMM d, yyyy")}`}.
            Please contact {company.company_name || "the company"} for an updated estimate.
          </p>
          {company.company_phone && (
            <a
              href={`tel:${company.company_phone}`}
              className="mt-4 inline-block text-emerald-600 font-medium hover:underline"
            >
              {company.company_phone}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-8 sm:px-8">
            <div className="flex items-start justify-between">
              <div>
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.company_name || "Company"}
                    className="h-10 mb-3 brightness-0 invert"
                  />
                ) : company.company_name ? (
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-5 w-5 text-slate-300" />
                    <span className="text-lg font-semibold text-white">
                      {company.company_name}
                    </span>
                  </div>
                ) : null}
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Estimate</h1>
                <p className="text-slate-300 mt-1">
                  {format(new Date(estimate.created_at), "MMMM d, yyyy")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Total</p>
                <p className="text-3xl font-bold text-white">
                  ${Number(estimate.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 sm:px-8 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {estimate.customer && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Prepared for
                  </p>
                  <p className="font-semibold text-slate-900">{estimate.customer.name}</p>
                  {estimate.customer.email && (
                    <p className="text-sm text-slate-500">{estimate.customer.email}</p>
                  )}
                </div>
              )}
              {estimate.job && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Job
                  </p>
                  <p className="font-semibold text-slate-900">
                    {estimate.job.name || estimate.customer?.name || "Unnamed Job"}
                  </p>
                  {estimate.job.address && (
                    <p className="text-sm text-slate-500">{estimate.job.address}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 sm:px-8 py-5">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4">
              Line Items
            </h2>
            <div className="space-y-0 divide-y divide-slate-100">
              {estimate.line_items.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                      )}
                      <p className="text-sm text-slate-400 mt-0.5">
                        {item.quantity} {item.unit} x ${Number(item.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 whitespace-nowrap">
                      ${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-100">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700">
                  ${Number(estimate.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Tax ({(Number(estimate.tax_rate) * 100).toFixed(1)}%)
                </span>
                <span className="text-slate-700">
                  ${Number(estimate.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {Number(estimate.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="text-emerald-600">
                    -${Number(estimate.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-lg font-bold text-slate-900">Total</span>
                <span className="text-lg font-bold text-slate-900">
                  ${Number(estimate.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {estimate.notes && (
            <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
              <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Notes
              </h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{estimate.notes}</p>
            </div>
          )}

          {estimate.expires_at && (
            <div className="px-6 sm:px-8 py-3 bg-amber-50 border-t border-amber-100">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-700">
                  This estimate expires on{" "}
                  {format(new Date(estimate.expires_at), "MMMM d, yyyy")}
                </p>
              </div>
            </div>
          )}

          <div className="px-6 sm:px-8 py-6 border-t border-slate-100">
            <Button
              onClick={handleApprove}
              disabled={approving}
              className={cn(
                "w-full h-14 text-lg font-semibold rounded-xl transition-all",
                "bg-emerald-600 hover:bg-emerald-700 text-white",
                "shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30"
              )}
            >
              {approving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Approving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  Approve Estimate
                </span>
              )}
            </Button>
            <p className="text-center text-xs text-slate-400 mt-3">
              By approving, you agree to the scope and pricing outlined above.
            </p>
          </div>
        </div>

        {company.company_name && (
          <p className="text-center text-sm text-slate-400 mt-6">
            Sent by {company.company_name}
            {company.company_email && ` -- ${company.company_email}`}
          </p>
        )}
      </div>
    </div>
  );
}
