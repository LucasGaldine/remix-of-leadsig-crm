import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Loader as Loader2, Phone, MessageSquare, Mail, MapPin, Calendar, DollarSign, Wrench, FileText, Navigation, Share2, CreditCard as Edit, Trash2, EllipsisVertical, Copy, Check, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildClientPortalShareUrl } from "@/lib/clientPortalUrl";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { openMapsWithAddress } from "@/lib/openMaps";

function PortalLinkButton({
  customerId,
  customDomain,
  className,
  variant = "default",
  size = "lg",
}: {
  customerId: string;
  customDomain?: string | null;
  className?: string;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [portalLink, setPortalLink] = useState("");

  const handleGenerateLink = async () => {
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

      const link = buildClientPortalShareUrl(token, { customDomain });
      setPortalLink(link);
      setDialogOpen(true);
    } catch (err) {
      toast.error("Failed to generate portal link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      setCopied(true);
      toast.success("Portal link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <>
      <Button
        className={className}
        variant={variant}
        size={size}
        onClick={handleGenerateLink}
        disabled={loading}
      >
        <Share2 className="h-4 w-4 shrink-0" />
        Client Portal
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Portal Link</DialogTitle>
            <DialogDescription>
              Share this link with your contact so they can view their jobs, estimates, and invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={portalLink}
              readOnly
              className="flex-1"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="outline" size="lg">
              Send by Email
            </Button>
            <Button type="button" variant="outline" size="lg">
              Send by Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  const [headerInfoOpen, setHeaderInfoOpen] = useState(false);

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
  const contactAddress = [customer.address, customer.city].filter(Boolean).join(", ");

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

  const handleCall = () => {
    if (!customer.phone) return;
    window.open(`tel:${customer.phone}`, "_self");
  };

  const handleText = () => {
    if (!customer.phone) return;
    window.open(`sms:${customer.phone}`, "_self");
  };

  const handleNavigate = () => {
    if (!contactAddress) return;
    openMapsWithAddress(contactAddress);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="" showBack backTo="/customers" />

      <div className="max-w-[var(--content-max-width)] m-auto px-4 pt-6 md:pt-8 pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3 min-w-0 w-full">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700 border border-sky-100 md:h-16 md:w-16">
                <User className="h-7 w-7 md:h-8 md:w-8" />
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <p className="text-1 text-2xl md:text-1 break-words">{customer.name}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mt-0.5">
                        <EllipsisVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Contact
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button
                  type="button"
                  onClick={() => setHeaderInfoOpen((current) => !current)}
                  className="group mt-1 flex items-center gap-2 p-0 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>More info</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      headerInfoOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>
            </div>

            <Collapsible
              open={headerInfoOpen}
              onOpenChange={setHeaderInfoOpen}
              className={cn(
                "w-full flex flex-col gap-0 md:flex-row md:items-center",
                headerInfoOpen ? "md:flex-wrap" : "md:flex-nowrap md:justify-between",
              )}
            >
              <CollapsibleContent className="order-2 w-full space-y-2 rounded-xl border border-border bg-card p-4 text-muted-foreground md:rounded-none md:border-0 md:bg-transparent md:p-0">
                <div className="space-y-2 text-base md:text-sm">
                  <p className="flex items-start gap-1">
                    <Phone className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-words min-w-0 text-foreground">{customer.phone || "No phone"}</span>
                  </p>
                  <p className="flex items-start gap-1">
                    <Mail className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-all min-w-0 text-foreground">{customer.email || "No email"}</span>
                  </p>
                  <p className="flex items-start gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-words min-w-0 text-foreground">{contactAddress || "No address"}</span>
                  </p>
                  <p className="flex items-start gap-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-words min-w-0 text-foreground">
                      Contact since {format(new Date(customer.created_at), "MMM d, yyyy")}
                    </span>
                  </p>
                  <p className="flex items-start gap-1">
                    <DollarSign className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-words min-w-0 text-foreground">
                      {totalValue > 0 ? `$${Number(totalValue).toLocaleString()}` : "No recorded revenue yet"}
                    </span>
                  </p>
                </div>
              </CollapsibleContent>

              <div
                className={cn(
                  "hidden md:flex items-center gap-2 flex-nowrap",
                  headerInfoOpen ? "order-3 w-full justify-start" : "order-1",
                )}
              >
                <Button aria-label="Call" variant="secondary" size="icon" onClick={handleCall} disabled={!customer.phone}>
                  <Phone className="h-4 w-4" />
                </Button>
                <Button aria-label="Text" variant="secondary" size="icon" onClick={handleText} disabled={!customer.phone}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button aria-label="Navigate" variant="secondary" size="icon" onClick={handleNavigate} disabled={!contactAddress}>
                  <Navigation className="h-4 w-4" />
                </Button>
                <PortalLinkButton
                  customerId={customer.id}
                  customDomain={currentAccount?.settings?.website?.custom_domain ?? null}
                  variant="secondary"
                  size="default"
                />
              </div>
            </Collapsible>
          </div>
        </div>
      </div>

      <div className="max-w-[var(--content-max-width)] m-auto px-4 pb-4 pt-2 md:pt-3">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start">
          <div className="bg-card -mx-4 md:mx-0 rounded-none md:rounded-lg md:border md:border-border overflow-hidden">
            <div className="grid grid-cols-3 px-2 md:border-b md:border-border">
              {[
                { id: "jobs", label: "Jobs" },
                { id: "estimates", label: "Estimates" },
                { id: "invoices", label: "Invoices" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    "w-full px-2 py-3 text-center text-base font-medium border-b-2 transition-colors min-h-touch whitespace-nowrap",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 p-5">
              {activeTab === "jobs" && (
                <>
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
                </>
              )}

              {activeTab === "estimates" && (
                <>
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
                </>
              )}

              {activeTab === "invoices" && (
                <>
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
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-elevated rounded-lg p-4">
              <p className="text-sm font-semibold text-foreground">Contact Snapshot</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center justify-between">
                  <span>Jobs</span>
                  <span className="text-foreground font-medium">{jobs.length}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Estimates</span>
                  <span className="text-foreground font-medium">{estimates.length}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Invoices</span>
                  <span className="text-foreground font-medium">{invoices.length}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Total Value</span>
                  <span className="text-foreground font-medium">
                    {totalValue > 0 ? `$${Number(totalValue).toLocaleString()}` : "$0"}
                  </span>
                </p>
              </div>

              <div className="mt-4 md:hidden">
                <PortalLinkButton
                  customerId={customer.id}
                  customDomain={currentAccount?.settings?.website?.custom_domain ?? null}
                  className="w-full"
                  size="default"
                />
              </div>
            </div>

            {customer.notes && (
              <div className="card-elevated rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <EditCustomerDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customer={customer}
        onCustomerUpdated={handleCustomerUpdated}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
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
              Delete Contact
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
