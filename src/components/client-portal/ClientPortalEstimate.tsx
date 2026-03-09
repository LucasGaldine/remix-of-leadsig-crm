import { useState } from "react";
import { Check, DollarSign, X, Download, CircleAlert as AlertCircle } from "lucide-react";
import { generateEstimatePDF } from "@/lib/pdfGenerator";

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

interface ClientPortalEstimateProps {
  estimate: {
    total: number;
    subtotal: number;
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
  };
  token: string;
  apiUrl: string;
  apiHeaders: Record<string, string>;
  onRefresh: () => void;
  jobId?: string | null;
  customerName?: string;
  jobName?: string;
  address?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  createdAt?: string;
  expiresAt?: string;
}

export function ClientPortalEstimate({
  estimate,
  token,
  apiUrl,
  apiHeaders,
  onRefresh,
  jobId = null,
  customerName = "Customer",
  jobName = "",
  address = "",
  companyName = "",
  companyEmail = "",
  companyPhone = "",
  createdAt,
  expiresAt,
}: ClientPortalEstimateProps) {
  const [submitting, setSubmitting] = useState<"approve" | "decline" | "approve_changes" | "decline_changes" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = estimate.status !== "accepted" && estimate.status !== "declined";
  const hasOriginalEstimate = estimate.original_total != null && estimate.original_line_items;
  const hasPendingChanges = estimate.has_pending_changes === true;

  const currentLineItems = estimate.line_items.filter((item) =>
    !item.is_change_order || item.change_order_type !== 'deleted'
  );

  const handleDownloadPDF = () => {
    generateEstimatePDF({
      customerName,
      jobName,
      address,
      companyName,
      companyEmail,
      companyPhone,
      lineItems: currentLineItems,
      subtotal: estimate.subtotal,
      taxRate: estimate.tax_rate,
      tax: estimate.tax,
      discount: estimate.discount,
      total: estimate.total,
      notes: estimate.notes,
      createdAt,
      expiresAt,
    });
  };

  const handleAction = async (action: "approve" | "decline") => {
    setSubmitting(action);
    setError(null);
    try {
      const url = jobId
        ? `${apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiUrl}?token=${token}`;
      const response = await fetch(url, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          action,
          updated_at: estimate.updated_at
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong");
        return;
      }

      onRefresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleChangeOrderAction = async (action: "approve_changes" | "decline_changes") => {
    setSubmitting(action);
    setError(null);
    try {
      const url = jobId
        ? `${apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiUrl}?token=${token}`;
      const response = await fetch(url, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          action,
          updated_at: estimate.updated_at
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong");
        return;
      }

      onRefresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const renderEstimateSection = (
    title: string,
    lineItems: LineItem[],
    subtotal: number,
    tax: number,
    discount: number,
    total: number,
    notes?: string | null,
    isPending?: boolean
  ) => (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>

      {lineItems.length > 0 && (
        <div className="px-4 py-4">
          <div className="space-y-0 divide-y divide-slate-100">
            {lineItems.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                      {isPending && item.is_change_order && item.change_order_approved === false && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.change_order_type === 'added'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.change_order_type === 'edited'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {item.change_order_type === 'added' && 'New'}
                          {item.change_order_type === 'edited' && 'Modified'}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.quantity} {item.unit} x $
                      {Number(item.unit_price).toFixed(2)}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900 whitespace-nowrap text-sm">
                    $
                    {Number(item.total).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-4 bg-slate-50 border-t border-slate-200">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-700">
              $
              {Number(subtotal).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">
              Tax ({(Number(estimate.tax_rate) * 100).toFixed(1)}%)
            </span>
            <span className="text-slate-700">
              $
              {Number(tax).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          {Number(discount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Discount</span>
              <span className="text-emerald-600">
                -$
                {Number(discount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-3 border-t border-slate-200">
            <span className="text-base font-bold text-slate-900">Total</span>
            <span className="text-base font-bold text-slate-900">
              $
              {Number(total).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {notes && (
        <div className="px-4 py-3 border-t border-slate-200">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Notes
          </p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {notes}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Estimate</h2>
          {estimate.status === "accepted" && !hasPendingChanges && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Approved
            </span>
          )}
          {estimate.status === "accepted" && hasPendingChanges && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Changes Pending
            </span>
          )}
          {estimate.status === "declined" && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
              Declined
            </span>
          )}
        </div>

        <button
          onClick={handleDownloadPDF}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {hasPendingChanges && hasOriginalEstimate ? (
        <div className="px-6 sm:px-8 py-5">
          <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                Changes Requiring Approval
              </p>
              <p className="text-xs text-amber-700 mt-1">
                The contractor has proposed changes to the original estimate. Please review both versions below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderEstimateSection(
              "Original Approved Estimate",
              estimate.original_line_items!,
              estimate.original_subtotal!,
              estimate.original_tax!,
              estimate.original_discount!,
              estimate.original_total!,
              estimate.original_notes
            )}

            {renderEstimateSection(
              "Proposed Changes",
              currentLineItems,
              estimate.subtotal,
              estimate.tax,
              estimate.discount,
              estimate.total,
              estimate.notes,
              true
            )}
          </div>

          <div className="mt-4">
            {error && (
              <p className="text-sm text-red-600 mb-3 text-center">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleChangeOrderAction("decline_changes")}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting === "decline_changes" ? (
                  <span className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {submitting === "decline_changes" ? "Declining..." : "Decline Changes"}
              </button>
              <button
                onClick={() => handleChangeOrderAction("approve_changes")}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting === "approve_changes" ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {submitting === "approve_changes" ? "Approving..." : "Approve Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {currentLineItems.length > 0 && (
            <div className="px-6 sm:px-8 py-5">
              <div className="space-y-0 divide-y divide-slate-100">
                {currentLineItems.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-slate-500 mt-0.5">
                            {item.description}
                          </p>
                        )}
                        <p className="text-sm text-slate-400 mt-0.5">
                          {item.quantity} {item.unit} x $
                          {Number(item.unit_price).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900 whitespace-nowrap">
                        $
                        {Number(item.total).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-100">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700">
                  $
                  {Number(estimate.subtotal).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Tax ({(Number(estimate.tax_rate) * 100).toFixed(1)}%)
                </span>
                <span className="text-slate-700">
                  $
                  {Number(estimate.tax).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {Number(estimate.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="text-emerald-600">
                    -$
                    {Number(estimate.discount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-lg font-bold text-slate-900">Total</span>
                <span className="text-lg font-bold text-slate-900">
                  $
                  {Number(estimate.total).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {estimate.notes && (
            <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Notes
              </p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {estimate.notes}
              </p>
            </div>
          )}
        </>
      )}

      {isPending && !hasPendingChanges && (
        <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
          {error && (
            <p className="text-sm text-red-600 mb-3 text-center">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => handleAction("decline")}
              disabled={submitting !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting === "decline" ? (
                <span className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {submitting === "decline" ? "Declining..." : "Decline"}
            </button>
            <button
              onClick={() => handleAction("approve")}
              disabled={submitting !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting === "approve" ? (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {submitting === "approve" ? "Approving..." : "Approve"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
