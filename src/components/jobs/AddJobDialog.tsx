import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { findOrCreateCustomer } from "@/lib/findOrCreateCustomer";
import { buildDefaultJobName } from "@/lib/defaultJobName";
import { useAddressVerification } from "@/hooks/useAddressVerification";
import { AddressVerificationBadge } from "@/components/address/AddressVerificationBadge";
import { useServiceTypeOptions } from "@/hooks/useServiceTypeOptions";
import { ServiceTypeSelect } from "@/components/shared/ServiceTypeSelect";


interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated?: (jobId: string) => void;
}

export function AddJobDialog({ open, onOpenChange, onJobCreated }: AddJobDialogProps) {
  const { user, currentAccount } = useAuth();
  const [saving, setSaving] = useState(false);
  const serviceTypeOptions = useServiceTypeOptions(open);
  const { verify, verifying, result: addressResult, reset: resetVerification } = useAddressVerification();
  
  const [formData, setFormData] = useState({
    name: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceType: "",
    address: "",
    estimatedValue: "",
    description: "",
    notes: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in");
      return;
    }
    if (!currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    setSaving(true);

    try {
      // First create or find the customer
      const { id: customerId } = await findOrCreateCustomer({
        name: formData.customerName.trim(),
        phone: formData.customerPhone.trim() || null,
        email: formData.customerEmail.trim() || null,
        address: formData.address.trim() || null,
        created_by: user.id,
        account_id: currentAccount.id,
      });

      // Then create the job (in the leads table)
      const { data: job, error: jobError } = await supabase
        .from("leads")
        .insert([{
          name: formData.name.trim() || buildDefaultJobName({
            customerName: formData.customerName,
            serviceType: formData.serviceType,
          }),
          customer_id: customerId,
          service_type: formData.serviceType || null,
          address: formData.address.trim() || null,
          estimated_value: formData.estimatedValue ? parseFloat(formData.estimatedValue) : null,
          description: formData.description.trim() || null,
          notes: formData.notes.trim() || null,
          created_by: user.id,
          account_id: currentAccount.id,
          status: "job",
          approval_status: "approved",
        }])
        .select()
        .single();

      if (jobError) throw jobError;

      toast.success("Job created successfully");
      
      // Reset form
      setFormData({
        name: "",
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        serviceType: "",
        address: "",
        estimatedValue: "",
        description: "",
        notes: "",
      });
      
      onOpenChange(false);
      onJobCreated?.(job.id);
    } catch (error) {
      console.error("Error creating job:", error);
      toast.error("Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Enter job and customer details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Job Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Smith Patio Project (optional)"
              className="mt-1.5"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">If left empty, we use: Customer Name, Service Type Job</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-3">Customer Info</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleChange("customerName", e.target.value)}
                  placeholder="John Smith"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => handleChange("customerPhone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleChange("customerEmail", e.target.value)}
                    placeholder="john@email.com"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-3">Job Details</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="serviceType">Service Type</Label>
                <ServiceTypeSelect
                  id="serviceType"
                  value={formData.serviceType} 
                  onValueChange={(v) => handleChange("serviceType", v)}
                  options={serviceTypeOptions}
                  className="mt-1.5 text-base [&>span]:text-base"
                />
              </div>

              <div>
                <Label htmlFor="address">Job Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => {
                    handleChange("address", e.target.value);
                    resetVerification();
                  }}
                  placeholder="123 Main St, Austin, TX 78701"
                  className="mt-1.5"
                />
                <AddressVerificationBadge
                  verifying={verifying}
                  result={addressResult}
                  onVerify={() => verify(formData.address)}
                  onAccept={(formatted) => handleChange("address", formatted)}
                />
              </div>

              <div>
                <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  value={formData.estimatedValue}
                  onChange={(e) => handleChange("estimatedValue", e.target.value)}
                  placeholder="5000"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Project scope and details..."
                  rows={2}
                  className="mt-1.5 text-base"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
