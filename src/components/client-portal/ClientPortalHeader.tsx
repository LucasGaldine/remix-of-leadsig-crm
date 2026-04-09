import { Building2, MapPin, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { hexToRgba } from "@/lib/clientPortalTheme";

interface ClientPortalHeaderProps {
  job: {
    name: string;
    address?: string;
    service_type?: string;
    description?: string;
    customer: { name: string } | null;
  };
  company: {
    company_name?: string;
    logo_url?: string;
  };
  estimate: { total: number } | null;
  statusLabel: string;
  statusColor: string;
  portalColor: string;
  portalTextColor: string;
}

export function ClientPortalHeader({
  job,
  company,
  estimate,
  statusLabel,
  statusColor,
  portalColor,
  portalTextColor,
}: ClientPortalHeaderProps) {
  const secondaryTextColor = hexToRgba(portalTextColor, 0.78);

  return (
    <div
      className="bg-white rounded-2xl shadow-lg overflow-hidden border"
      style={{ borderColor: hexToRgba(portalTextColor, 0.8) }}
    >
      <div
        className="px-6 py-8 sm:px-8"
        style={{ backgroundColor: portalColor }}
      >
        <div className="flex items-start justify-between">
          <div>
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.company_name || "Company"}
                className="h-10 w-auto max-w-[220px] object-contain mb-3"
              />
            ) : company.company_name ? (
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-5 w-5" style={{ color: secondaryTextColor }} />
                <span className="text-lg font-semibold" style={{ color: portalTextColor }}>
                  {company.company_name}
                </span>
              </div>
            ) : null}
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: portalTextColor }}>
              {job.name || job.customer?.name || "Unnamed Job"}
            </h1>
            {job.service_type && (
              <div className="flex items-center gap-1.5 mt-2" style={{ color: secondaryTextColor }}>
                <Wrench className="h-4 w-4" />
                <span className="text-sm">{job.service_type}</span>
              </div>
            )}
            {job.address && (
              <div className="flex items-center gap-1.5 mt-1" style={{ color: secondaryTextColor }}>
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{job.address}</span>
              </div>
            )}
          </div>
          <div className="text-right ml-4 shrink-0">
            <span
              className={cn(
                "inline-block px-3 py-1 rounded-full text-xs font-semibold",
                statusColor
              )}
            >
              {statusLabel}
            </span>
            {estimate && (
              <p className="text-3xl font-bold mt-3" style={{ color: portalTextColor }}>
                ${Number(estimate.total).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {job.description && (
        <div className="px-6 sm:px-8 py-5 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            Project Description
          </p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {job.description}
          </p>
        </div>
      )}
    </div>
  );
}
