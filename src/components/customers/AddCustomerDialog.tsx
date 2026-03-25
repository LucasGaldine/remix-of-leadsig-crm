import { useState } from "react";
import { Loader as Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { getCustomerWriteErrorMessage } from "@/lib/customerErrors";
import { toast } from "sonner";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: () => void;
  onImportFromCSV?: () => void;
}

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
};

export function AddCustomerDialog({ open, onOpenChange, onCustomerCreated, onImportFromCSV }: AddCustomerDialogProps) {
  const createCustomer = useCreateCustomer();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setSaving(true);
    try {
      await createCustomer.mutateAsync({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
      });

      toast.success("Customer created successfully");
      resetForm();
      onOpenChange(false);
      onCustomerCreated?.();
    } catch (error: unknown) {
      const errorMessage = getCustomerWriteErrorMessage(error, "Failed to create customer");
      console.error("Error creating customer:", error);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
        </DialogHeader>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 mt-2"
          onClick={() => {
            onOpenChange(false);
            onImportFromCSV?.();
          }}
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
          <div className="space-y-2">
            <Label htmlFor="new-customer-name">Name *</Label>
            <Input
              id="new-customer-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Customer name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-customer-phone">Phone</Label>
            <Input
              id="new-customer-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(123) 456-7890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-customer-email">Email</Label>
            <Input
              id="new-customer-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-customer-address">Address</Label>
            <Input
              id="new-customer-address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-customer-city">City</Label>
            <Input
              id="new-customer-city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Austin"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
