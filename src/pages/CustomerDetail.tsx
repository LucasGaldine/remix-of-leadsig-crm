import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Loader as Loader2, Phone, MessageSquare, Mail, MapPin, Calendar, DollarSign, Wrench, FileText, Navigation, Share2, CreditCard as Edit, Trash2, EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ClientShareLink } from "@/components/jobs/ClientShareLink";
import { toast } from "sonner";
import { EditCustomerDialog } from "@/components/customers/EditCustomerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function PortalLinkButton({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateAndCopy = async () => {
    setLoading(true);
    try {
      const { data: customer } = await supabase
        .from("customers")
        .select("client_portal_token")
        .eq("id", customerId)
        .maybeSingle();

      let token = customer?.client_portal_token || null;

      if (!token) {
        token = crypto.randomUUID();
        const { error } = await supabase
          .from("customers")
          .update({ client_portal_token: token })
          .eq("id", customerId);
        if (error) throw error;
      }

      const link = `${window.location.origin}/client/job?token=${token}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Portal link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to generate portal link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className="bg-emerald-600 hover:bg-emerald-700 text-white"
      size="lg"
      onClick={handleGenerateAndCopy}
      disabled={loading}
    >
      <Share2 className="h-4 w-4 shrink-0" />
      Client Portal
    </Button>
  );
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"jobs" | "estimates" | "invoices">("jobs");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const totalEstimatedValue = jobs.reduce((sum: number, job: any) => sum + (job.estimated_value || 0), 0);
  const totalActualValue = jobs.reduce((sum: number, job: any) => sum + (job.actual_value || 0), 0);
  const totalValue = totalActualValue || totalEstimatedValue;

  const handleDeleteCustomer = async () => {
    if (!customer?.id) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id);

      if (error) throw error;

      toast.success("Customer and all associated data deleted");
      navigate("/customers");
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast.error(error.message || "Failed to delete customer");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleCustomerUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["customer", id] });
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="" showBack backTo="/customers" />

      <main className="max-w-[var(--content-max-width)] m-auto p-4 pb-0">
        {/* Contact Info Card */}
        <div className="bg-card rounded-lg border border-border">
          <div className="flex p-4 pt-8 pb-8">
            {/* Left Column */}
            <div className="flex flex-col w-full justify-between gap-4">
              {/* Customer Info */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <p className="text-1">{customer.name}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <EllipsisVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Customer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Customer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="text-5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{customer.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{customer.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {customer.address && customer.city
                        ? `${customer.address}, ${customer.city}`
                        : customer.address || customer.city || "No address"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Buttons */}
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`tel:${customer.phone}`)}
                  disabled={!customer.phone}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`sms:${customer.phone}`)}
                  disabled={!customer.phone}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const location = [customer.address, customer.city].filter(Boolean).join(", ");
                    window.open(`https://maps.google.com/?q=${encodeURIComponent(location)}`);
                  }}
                  disabled={!customer.address && !customer.city}
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col w-full justify-between">
              {/* Customer Stats */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  {/* Empty space to match layout */}
                </div>

                <div className="text-5 text-right animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-2">{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}</p>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <PortalLinkButton customerId={customer.id} />
              </div>
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

      <EditCustomerDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customer={customer}
        onCustomerUpdated={handleCustomerUpdated}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {customer.name} and all associated jobs, estimates, invoices, and data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCustomer}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
