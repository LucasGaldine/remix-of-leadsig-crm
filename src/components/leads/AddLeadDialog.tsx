import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated?: (leadId: string) => void;
}

const SERVICE_TYPES = [
  "Pavers / Patio",
  "Concrete",
  "Sod / Lawn",
  "Deck",
  "Fencing",
  "Retaining Wall",
  "Landscaping",
  "Hardscaping",
  "Other",
];

export function AddLeadDialog({ open, onOpenChange, onLeadCreated }: AddLeadDialogProps) {
  const { user, currentAccount } = useAuth();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    serviceType: "",
    city: "",
    address: "",
    estimatedBudget: "",
    source: "Manual",
    notes: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Name is required");
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
      const { data, error } = await supabase
        .from("leads")
        .insert([{
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          service_type: formData.serviceType || null,
          city: formData.city.trim() || null,
          address: formData.address.trim() || null,
          estimated_value: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : null,
          source: formData.source || "Manual",
          notes: formData.notes.trim() || null,
          created_by: user.id,
          account_id: currentAccount.id,
          status: "new",
          approval_status: "approved",
        }])
        .select()
        .single();

      if (error) throw error;

      // Log interaction for lead creation
      await supabase.from("interactions").insert({
        lead_id: data.id,
        account_id: currentAccount.id,
        type: "system",
        direction: "na",
        summary: "Lead created manually",
        created_by: user.id,
      });

      toast.success("Lead created successfully");
      
      // Reset form
      setFormData({
        name: "",
        phone: "",
        email: "",
        serviceType: "",
        city: "",
        address: "",
        estimatedBudget: "",
        source: "Manual",
        notes: "",
      });
      
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Enter the lead's information below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="John Smith"
              className="mt-1.5"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john@email.com"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="serviceType">Service Type</Label>
            <Select 
              value={formData.serviceType} 
              onValueChange={(v) => handleChange("serviceType", v)}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="Austin"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="estimatedBudget">Budget ($)</Label>
              <Input
                id="estimatedBudget"
                type="number"
                value={formData.estimatedBudget}
                onChange={(e) => handleChange("estimatedBudget", e.target.value)}
                placeholder="5000"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="123 Main St"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="mt-1.5"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
