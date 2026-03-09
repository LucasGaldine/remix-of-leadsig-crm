import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader as Loader2, Phone, MessageSquare, Mail, MapPin, Calendar, DollarSign, Wrench, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAccount } = useAuth();

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
      <PageHeader title={customer.name} showBack backTo="/customers" />

      <main className="px-4 py-4 space-y-5 max-w-[var(--content-max-width)] m-auto">
        {/* Contact Info Card */}
        <div className="card-elevated rounded-xl overflow-hidden">
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {customer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{customer.name}</h2>
                {customer.email && (
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                )}
              </div>
            </div>

            {customer.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{customer.phone}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{location}</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-border px-5 py-3 flex gap-2">
            {customer.phone && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`tel:${customer.phone}`)}
                  className="flex-1"
                >
                  <Phone className="h-4 w-4 mr-1" /> Call
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`sms:${customer.phone}`)}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-1" /> Text
                </Button>
              </>
            )}
            {customer.email && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`mailto:${customer.email}`)}
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-1" /> Email
              </Button>
            )}
            {location && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(location)}`)}
                className="flex-1"
              >
                <MapPin className="h-4 w-4 mr-1" /> Map
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="jobs" className="flex-1">Jobs</TabsTrigger>
            <TabsTrigger value="estimates" className="flex-1">Estimates</TabsTrigger>
            <TabsTrigger value="invoices" className="flex-1">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="mt-3 space-y-2">
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
          </TabsContent>

          <TabsContent value="estimates" className="mt-3 space-y-2">
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
          </TabsContent>

          <TabsContent value="invoices" className="mt-3 space-y-2">
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
          </TabsContent>
        </Tabs>

        {/* Notes */}
        {customer.notes && (
          <div className="card-elevated rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </main>

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
