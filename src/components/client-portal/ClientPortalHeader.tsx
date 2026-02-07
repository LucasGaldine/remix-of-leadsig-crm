import { Building2, MapPin, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export function ClientPortalHeader({
  job,
  company,
  estimate,
  statusLabel,
  statusColor,
}: ClientPortalHeaderProps) {
  return (
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
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {job.customer?.name || job.name}
            </h1>
            {job.service_type && (
              <div className="flex items-center gap-1.5 mt-2 text-slate-300">
                <Wrench className="h-4 w-4" />
                <span className="text-sm">{job.service_type}</span>
              </div>
            )}
            {job.address && (
              <div className="flex items-center gap-1.5 mt-1 text-slate-300">
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
              <p className="text-3xl font-bold text-white mt-3">
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
