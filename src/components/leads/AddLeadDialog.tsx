import { useState } from "react";
import { Loader as Loader2, Mic, Upload } from "lucide-react";
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
import { VoiceIntakePanel } from "@/components/voice/VoiceIntakePanel";
import { matchServiceType, normalizeVoiceLeadParsedData } from "@/lib/voiceIntake";
import type { VoiceLeadParsedData } from "@/types/voiceIntake";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const createCustomer = useCreateCustomer();
  const [saving, setSaving] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showVoiceLeadIntake, setShowVoiceLeadIntake] = useState(false);

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

  const applyVoiceLeadIntake = (parsedData: VoiceLeadParsedData) => {
    const parsed = normalizeVoiceLeadParsedData(parsedData);

    setClientMode("new");
    setSelectedCustomer(null);
    setNewClientData((current) => ({
      ...current,
      name: parsed.customerName || current.name,
      phone: parsed.customerPhone || current.phone || "",
      email: parsed.customerEmail || current.email || "",
      address: parsed.customerAddress || current.address || "",
      city: parsed.customerCity || current.city || "",
    }));
    setLeadData((current) => ({
      ...current,
      serviceType: matchServiceType(parsed.serviceType, SERVICE_TYPES) || current.serviceType,
      estimatedBudget: parsed.estimatedBudget !== undefined
        ? String(Math.round(parsed.estimatedBudget))
        : current.estimatedBudget,
      source: parsed.source || current.source || "Manual",
      notes: parsed.notes || current.notes,
    }));
    setShowVoiceLeadIntake(false);
  };

  const resetForm = () => {
    setClientMode("existing");
    setSelectedCustomer(null);
    setNewClientData({ ...INITIAL_CLIENT_DATA });
    setLeadData({ serviceType: "", estimatedBudget: "", source: "Manual", notes: "" });
    setShowVoiceLeadIntake(false);
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-counts"] }),
      ]);

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



          <div className={`mt-2 grid gap-2 ${showVoiceLeadIntake ? "grid-cols-1" : "grid-cols-2"}`}>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => { onOpenChange(false); setShowCSVImport(true); }}
            >
              <Upload className="h-4 w-4" />
              Import from CSV
            </Button>
            {!showVoiceLeadIntake && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowVoiceLeadIntake(true)}
              >
                <Mic className="h-4 w-4 mr-2" />
                Voice Lead Intake
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Or add manually
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!showVoiceLeadIntake ? (
              <>
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
              </>
            ) : (
              <div className="space-y-3">
                <VoiceIntakePanel
                  entityType="lead"
                  title="Voice Lead Intake"
                  description="Speak naturally and I’ll map this into lead fields. If required info is missing, follow-up questions appear before apply."
                  transcriptPlaceholder="Example: New lead Sarah Johnson, phone 555-111-2222, wants a driveway pressure wash at 11 Elm Street, budget about 650, source is referral..."
                  variant="plain"
                  onApply={(parsed) => applyVoiceLeadIntake(parsed as VoiceLeadParsedData)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowVoiceLeadIntake(false)}
                >
                  Back to Manual Form
                </Button>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" size="lg" onClick={() => { resetForm(); onOpenChange(false); }}>
                Cancel
              </Button>
              <Button size="lg" type="submit" disabled={saving || showVoiceLeadIntake}>
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
