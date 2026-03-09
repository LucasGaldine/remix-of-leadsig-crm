import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Loader as Loader2, Phone, MessageSquare, Mail, MapPin, Calendar, DollarSign, Wrench, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const [activeTab, setActiveTab] = useState<"jobs" | "estimates" | "invoices">("jobs");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["customer-jobs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("customer_id", id!)
        .eq("account_id", currentAccount?.id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!currentAccount,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["customer-estimates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .eq("customer_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, lead:leads!invoices_lead_id_fkey(id, name)")
        .eq("customer_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24">
        <PageHeader title="Customer Not Found" showBack backTo="/customers" />
        <main className="px-4 py-8 text-center">
          <p className="text-muted-foreground">This customer could not be found.</p>
        </main>
        <MobileNav />
      </div>
    );
  }

  const location = [customer.address, customer.city].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="" showBack backTo="/customers" />

      <main className="max-w-[var(--content-max-width)] m-auto p-4 pb-0">
        {/* Contact Info Card */}
        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 pt-8 pb-8">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              {/* Left Column */}
              <div className="flex flex-col flex-1 min-w-0 gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base">
                    {customer.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <h2 className="text-1 font-bold text-foreground">{customer.name}</h2>
                </div>

                <div className="text-5">
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col sm:items-end gap-2">
                <div className="sm:text-right text-muted-foreground">
                  <p className="text-2">{jobs.length + estimates.length + invoices.length}</p>
                  <p className="text-xs">Total Records</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              {customer.phone && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs px-2"
                    onClick={() => window.open(`tel:${customer.phone}`)}
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="hidden xs:inline">Call</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs px-2"
                    onClick={() => window.open(`sms:${customer.phone}`)}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="hidden xs:inline">Text</span>
                  </Button>
                </>
              )}
              {customer.email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs px-2"
                  onClick={() => window.open(`mailto:${customer.email}`)}
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Email</span>
                </Button>
              )}
              {location && !customer.phone && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs px-2"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(location)}`)}
                >
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Map</span>
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-[var(--content-max-width)] border-t ml-auto mr-auto px-4">
            <div className="flex">
              {[
                { id: "jobs", label: "Jobs" },
                { id: "estimates", label: "Estimates" },
                { id: "invoices", label: "Invoices" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-touch whitespace-nowrap",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Tab Content */}
      <div className="p-4 max-w-[var(--content-max-width)] m-auto">{activeTab === "jobs" && (
          <div className="space-y-2">

            {jobs.length === 0 ? (
              <div className="card-elevated rounded-lg p-6 text-center">
                <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No jobs for this customer</p>
              </div>
            ) : (
              jobs.map((job: any) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{job.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {job.service_type || "Service"} • {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === "estimates" && (
          <div className="space-y-2">
            {estimates.length === 0 ? (
              <div className="card-elevated rounded-lg p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No estimates for this customer</p>
              </div>
            ) : (
              estimates.map((est: any) => (
                <button
                  key={est.id}
                  onClick={() => navigate(`/payments/estimates/${est.id}`)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{est.name || "Estimate"}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(est.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        ${Number(est.total || 0).toLocaleString()}
                      </p>
                      <StatusBadge status={est.status} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-2">
            {invoices.length === 0 ? (
              <div className="card-elevated rounded-lg p-6 text-center">
                <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No invoices for this customer</p>
              </div>
            ) : (
              invoices.map((inv: any) => (
                <button
                  key={inv.id}
                  onClick={() => navigate(`/payments/invoices/${inv.id}`)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        ${Number(inv.total || 0).toLocaleString()}
                      </h3>
                      {inv.lead && (
                        <p className="text-sm text-muted-foreground">
                          {inv.lead.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inv.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="p-4 max-w-[var(--content-max-width)] m-auto">
          <div className="card-elevated rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    qualified: { label: "Qualified", className: "bg-accent text-accent-foreground" },
    job: { label: "Job", className: "bg-primary/10 text-primary" },
    completed: { label: "Completed", className: "bg-primary/20 text-primary" },
    paid: { label: "Paid", className: "bg-primary/20 text-primary" },
    sent: { label: "Sent", className: "bg-accent text-accent-foreground" },
    approved: { label: "Approved", className: "bg-primary/10 text-primary" },
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    pending: { label: "Pending", className: "bg-accent text-accent-foreground" },
  };

  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}
