import { DollarSign } from "lucide-react";

interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
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
    line_items: LineItem[];
  };
}

export function ClientPortalEstimate({ estimate }: ClientPortalEstimateProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Estimate</h2>
          {estimate.status === "accepted" && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Approved
            </span>
          )}
        </div>
      </div>

      {estimate.line_items.length > 0 && (
        <div className="px-6 sm:px-8 py-5">
          <div className="space-y-0 divide-y divide-slate-100">
            {estimate.line_items.map((item) => (
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
    </div>
  );
}
