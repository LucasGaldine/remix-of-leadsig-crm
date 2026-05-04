import { useState } from "react";
import { Loader as Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { getCustomerWriteErrorMessage } from "@/lib/customerErrors";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
import {
  findExistingCustomerMatch,
  type ExistingCustomerMatch,
} from "@/lib/findExistingCustomerMatch";
import { useNavigate } from "react-router-dom";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: (customerId: string) => void;
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
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const createCustomer = useCreateCustomer();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [existingCustomerMatch, setExistingCustomerMatch] = useState<ExistingCustomerMatch | null>(null);
  const [confirmedExistingCustomerId, setConfirmedExistingCustomerId] = useState<string | null>(null);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setExistingCustomerMatch(null);
    setConfirmedExistingCustomerId(null);
  };

  const getMatchReasonLabel = (match: ExistingCustomerMatch): string => {
    if (match.reason === "address_and_name") return "same name and address";
    if (match.reason === "phone") return "matching phone number";
    return "matching email address";
  };

  const submitContact = async () => {
    if (!formData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    try {
      if (currentAccount?.id) {
        const match = await findExistingCustomerMatch({
          accountId: currentAccount.id,
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
        });

        if (match && confirmedExistingCustomerId !== match.customer.id) {
          setExistingCustomerMatch(match);
          return;
        }
      }

      setSaving(true);

      const customer = await createCustomer.mutateAsync({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
      });

      toast.success("Contact created successfully");
      resetForm();
      onOpenChange(false);
      onCustomerCreated?.(customer.id);
      navigate(`/customers/${customer.id}`);
    } catch (error: unknown) {
      const errorMessage = getCustomerWriteErrorMessage(error, "Failed to create contact");
      console.error("Error creating contact:", error);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitContact();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) resetForm();
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
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
              placeholder="Contact name"
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
              Add Contact
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!existingCustomerMatch}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setExistingCustomerMatch(null);
            setConfirmedExistingCustomerId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use existing contact?</AlertDialogTitle>
            <AlertDialogDescription>
              We found an existing contact, <strong>{existingCustomerMatch?.customer.name}</strong>, because of{" "}
              {existingCustomerMatch ? getMatchReasonLabel(existingCustomerMatch) : "a duplicate match"}.
              Saving will use that existing contact instead of creating a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setExistingCustomerMatch(null);
                setConfirmedExistingCustomerId(null);
              }}
            >
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!existingCustomerMatch) return;
                setConfirmedExistingCustomerId(existingCustomerMatch.customer.id);
                setExistingCustomerMatch(null);
                void submitContact();
              }}
            >
              Yes, use existing contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
