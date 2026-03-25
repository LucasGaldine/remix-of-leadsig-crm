import { useState } from "react";
import { Loader as Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCreateCustomer, type Customer, type CreateCustomerInput } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { CSVImportModal } from "./CSVImportModal";
import { ClientSelector } from "@/components/clients/ClientSelector";
import { formatCurrency } from "@/lib/formatter";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated?: (leadId: string) => void;
}

const INITIAL_CLIENT_DATA: CreateCustomerInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
};

export function AddLeadDialog({ open, onOpenChange, onLeadCreated }: AddLeadDialogProps) {
  const { user, currentAccount } = useAuth();
  const createCustomer = useCreateCustomer();
  const [saving, setSaving] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newClientData, setNewClientData] = useState<CreateCustomerInput>({ ...INITIAL_CLIENT_DATA });

  const [leadData, setLeadData] = useState({
    serviceType: "",
    estimatedBudget: "",
    source: "Manual",
    notes: "",
  });

  const handleLeadChange = (field: string, value: string) => {
    setLeadData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBudgetChange = (value) => {
  const numericValue = value.replace(/\D/g, ""); // raw number
  handleLeadChange("estimatedBudget", numericValue);
  };

  const resetForm = () => {
    setClientMode("existing");
    setSelectedCustomer(null);
    setNewClientData({ ...INITIAL_CLIENT_DATA });
    setLeadData({ serviceType: "", estimatedBudget: "", source: "Manual", notes: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (clientMode === "new" && !newClientData.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (clientMode === "existing" && !selectedCustomer) {
      toast.error("Please select a client or create a new one");
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in");
      return;
    }

    if (!currentAccount) {
      toast.error("No account selected");
      return;
    }

    setSaving(true);

    try {
      let customerId: string;
      let customerName: string;
      let customerPhone: string | null = null;
      let customerEmail: string | null = null;
      let customerAddress: string | null = null;
      let customerCity: string | null = null;

      if (clientMode === "new") {
        const customer = await createCustomer.mutateAsync({
          name: newClientData.name.trim(),
          phone: newClientData.phone?.trim() || null,
          email: newClientData.email?.trim() || null,
          address: newClientData.address?.trim() || null,
          city: newClientData.city?.trim() || null,
        });
        customerId = customer.id;
        customerName = customer.name;
        customerPhone = customer.phone;
        customerEmail = customer.email;
        customerAddress = customer.address;
        customerCity = customer.city;
      } else if (clientMode === "existing" && selectedCustomer) {
        customerId = selectedCustomer.id;
        customerName = selectedCustomer.name;
        customerPhone = selectedCustomer.phone;
        customerEmail = selectedCustomer.email;
        customerAddress = selectedCustomer.address;
        customerCity = selectedCustomer.city;
      } else {
        toast.error("Please select a client or create a new one");
        return;
      }

      const { data, error } = await supabase
        .from("leads")
        .insert([{
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          address: customerAddress,
          city: customerCity,
          customer_id: customerId,
          service_type: leadData.serviceType || null,
          estimated_value: leadData.estimatedBudget ? parseFloat(leadData.estimatedBudget) : null,
          source: leadData.source || "Manual",
          created_by: user.id,
          account_id: currentAccount.id,
          status: "new",
          approval_status: "approved",
        }])
        .select()
        .single();

      if (error) throw error;

      await supabase.from("interactions").insert({
        lead_id: data.id,
        account_id: currentAccount.id,
        type: "system",
        direction: "na",
        summary: "Lead created manually",
        created_by: user.id,
      });

      if (leadData.notes.trim()) {
        await supabase.from("interactions").insert({
          lead_id: data.id,
          account_id: currentAccount.id,
          type: "note",
          direction: "na",
          summary: leadData.notes.trim().slice(0, 100),
          body: leadData.notes.trim(),
          created_by: user.id,
        });
      }

      toast.success("Lead created successfully");
      resetForm();
      onOpenChange(false);
      onLeadCreated?.(data.id);
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Failed to create lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CSVImportModal
        open={showCSVImport}
        onOpenChange={setShowCSVImport}
        onImportComplete={() => onLeadCreated?.("")}
      />
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>



          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 mt-2"
            onClick={() => { onOpenChange(false); setShowCSVImport(true); }}
          >
            <Upload className="h-4 w-4" />
            Import from CSV
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Or add manually
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <ClientSelector
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
              newClientData={newClientData}
              onNewClientDataChange={setNewClientData}
              mode={clientMode}
              onModeChange={setClientMode}
            />

            

            <div>
                <Label htmlFor="serviceType">Service Type</Label>
                <Select
                  value={leadData.serviceType}
                  onValueChange={(v) => handleLeadChange("serviceType", v)}
                >
                  <SelectTrigger id="serviceType" className="mt-1.5">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="estimatedBudget">Budget</Label>
                <Input
                  id="estimatedBudget"
                  type="text"
                  value={formatCurrency(leadData.estimatedBudget)}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  placeholder="$5,000"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={leadData.notes}
                  onChange={(e) => handleLeadChange("notes", e.target.value)}
                  placeholder="Any additional notes..."
                  className="mt-1.5 min-h-[60px] resize-none"
                />
              </div>


            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" size="lg" onClick={() => { resetForm(); onOpenChange(false); }}>
                Cancel
              </Button>
              <Button size="lg" type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
