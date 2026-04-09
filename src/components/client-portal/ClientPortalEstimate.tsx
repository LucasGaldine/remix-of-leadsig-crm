import { useEffect, useMemo, useState } from "react";
import { Check, DollarSign, X, Download, CircleAlert as AlertCircle } from "lucide-react";
import { generateEstimatePDF } from "@/lib/pdfGenerator";
import { normalizeClientPortalColor, normalizeClientPortalTextColor } from "@/lib/clientPortalTheme";

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
  companyLogoUrl?: string;
  companyEmail?: string;
  companyPhone?: string;
  createdAt?: string;
  expiresAt?: string;
  portalColor?: string;
  portalTextColor?: string;
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
  companyLogoUrl = "",
  companyEmail = "",
  companyPhone = "",
  createdAt,
  expiresAt,
  portalColor = "",
  portalTextColor = "",
}: ClientPortalEstimateProps) {
  const [submitting, setSubmitting] = useState<"approve" | "decline" | "approve_changes" | "decline_changes" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const isPending = estimate.status !== "accepted" && estimate.status !== "declined";
  const hasOriginalEstimate = estimate.original_total != null && estimate.original_line_items;
  const hasPendingChanges = estimate.has_pending_changes === true;
  const availableVersions = useMemo(
    () => estimate.estimate_versions || [],
    [estimate.estimate_versions],
  );

  useEffect(() => {
    if (availableVersions.length === 0) {
      setSelectedVersionId(null);
      return;
    }

    setSelectedVersionId((previous) => {
      if (previous && availableVersions.some((version) => version.id === previous)) {
        return previous;
      }
      return availableVersions[availableVersions.length - 1].id;
    });
  }, [availableVersions]);

  const selectedVersion = useMemo(
    () => availableVersions.find((version) => version.id === selectedVersionId) || null,
    [availableVersions, selectedVersionId],
  );

  const currentLineItems = estimate.line_items.filter((item) =>
    !item.is_change_order || item.change_order_type !== 'deleted'
  );

  const displayLineItems = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.line_items
    : currentLineItems;
  const displaySubtotal = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.subtotal
    : estimate.subtotal;
  const displayTax = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.tax
    : estimate.tax;
  const displayDiscount = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.discount
    : estimate.discount;
  const displayTotal = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.total
    : estimate.total;
  const displayNotes = isPending && !hasPendingChanges && selectedVersion
    ? selectedVersion.notes
    : estimate.notes;
  const displayProfitMargin = isPending && !hasPendingChanges && selectedVersion
    ? Number(selectedVersion.profit_margin || 0)
    : Number(estimate.profit_margin || 0);
  const displayTaxRate = isPending && !hasPendingChanges && selectedVersion
    ? Number(selectedVersion.tax_rate || estimate.tax_rate)
    : Number(estimate.tax_rate);
  const normalizedPortalColor = normalizeClientPortalColor(portalColor);
  const normalizedPortalTextColor = normalizeClientPortalTextColor(portalTextColor);

  const handleDownloadPDF = async () => {
    await generateEstimatePDF({
      customerName,
      jobName,
      address,
      companyName,
      companyLogoUrl,
      companyEmail,
      companyPhone,
      lineItems: displayLineItems,
      subtotal: displaySubtotal,
      taxRate: displayTaxRate,
      tax: displayTax,
      discount: displayDiscount,
      total: displayTotal,
      notes: displayNotes || undefined,
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
          updated_at: estimate.updated_at,
          estimate_version_id: action === "approve" ? selectedVersionId : undefined,
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
    taxRate: number,
    profitMargin: number,
    tax: number,
    discount: number,
    total: number,
    notes?: string | null
  ) => (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>

      {lineItems.length > 0 && (
        <div className="px-4 py-4">
          <div className="space-y-0">
            {lineItems.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-slate-900 text-sm">{item.name}</p>
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
          {Number(profitMargin) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                Profit Margin ({Number(profitMargin).toFixed(1)}%)
              </span>
              <span className="text-slate-700">
                $
                {(Number(subtotal) * (Number(profitMargin) / 100)).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                Tax ({(Number(taxRate) * 100).toFixed(1)}%)
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
        {isPending && !hasPendingChanges && availableVersions.length > 0 && (
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Choose Option
            </label>
            <select
              value={selectedVersionId || ""}
              onChange={(event) => setSelectedVersionId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {availableVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.name} - ${Number(version.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </option>
              ))}
            </select>
          </div>
        )}
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
              estimate.tax_rate,
              estimate.profit_margin || 0,
              estimate.original_tax!,
              estimate.original_discount!,
              estimate.original_total!,
              estimate.original_notes
            )}

            {renderEstimateSection(
              "Proposed Changes",
              currentLineItems,
              estimate.subtotal,
              estimate.tax_rate,
              estimate.profit_margin || 0,
              estimate.tax,
              estimate.discount,
              estimate.total,
              estimate.notes
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
              >
                {submitting === "approve_changes" ? (
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
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
          {displayLineItems.length > 0 && (
            <div className="px-6 sm:px-8 py-5">
              <div className="space-y-0">
                {displayLineItems.map((item) => (
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
                  {Number(displaySubtotal).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {displayProfitMargin > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Profit Margin ({displayProfitMargin.toFixed(1)}%)
                  </span>
                  <span className="text-slate-700">
                    $
                    {(Number(displaySubtotal) * (displayProfitMargin / 100)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Tax ({(Number(displayTaxRate) * 100).toFixed(1)}%)
                </span>
                <span className="text-slate-700">
                  $
                  {Number(displayTax).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {Number(displayDiscount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="text-emerald-600">
                    -$
                    {Number(displayDiscount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-lg font-bold text-slate-900">Total</span>
                <span className="text-lg font-bold text-slate-900">
                  $
                  {Number(displayTotal).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {displayNotes && (
            <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Notes
              </p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {displayNotes}
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: normalizedPortalColor, color: normalizedPortalTextColor }}
            >
              {submitting === "approve" ? (
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
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
