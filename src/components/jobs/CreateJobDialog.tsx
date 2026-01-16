import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateJob } from "@/hooks/useJobs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateJobDialog({ open, onOpenChange }: CreateJobDialogProps) {
  const { user, currentAccount } = useAuth();
  const [jobName, setJobName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createJob = useCreateJob();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to create a job");
      return;
    }

    if (!currentAccount) {
      toast.error("No account selected");
      return;
    }

    setIsLoading(true);

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: customerName,
          phone: phone || null,
          email: email || null,
          address: jobAddress || null,
          created_by: user.id,
          account_id: currentAccount.id,
        })
        .select()
        .single();

      if (customerError) throw customerError;

      await createJob.mutateAsync({
        name: jobName,
        customer_id: customer.id,
        phone: phone || null,
        email: email || null,
        service_type: serviceType || null,
        address: jobAddress || null,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        description: description || null,
        status: "scheduled",
      });

      toast.success("Job created successfully!");

      setJobName("");
      setCustomerName("");
      setPhone("");
      setEmail("");
      setServiceType("");
      setJobAddress("");
      setEstimatedValue("");
      setDescription("");

      onOpenChange(false);
    } catch (error) {
      console.error("Error creating job:", error);
      toast.error("Failed to create job. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setJobName("");
    setCustomerName("");
    setPhone("");
    setEmail("");
    setServiceType("");
    setJobAddress("");
    setEstimatedValue("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Create New Job</DialogTitle>
          <p className="text-gray-500 text-base">Enter job and customer details below.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="jobName" className="text-base font-semibold text-gray-900">
              Job Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Smith Patio Project"
              className="h-14 text-base border-2 border-gray-300 focus-visible:border-emerald-600 focus-visible:ring-0 rounded-xl"
              required
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Customer Info</h3>

            <div className="space-y-2">
              <Label htmlFor="customerName" className="text-base font-semibold text-gray-900">
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Smith"
                className="h-12 text-base border-gray-300 rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base font-semibold text-gray-900">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="h-12 text-base border-gray-300 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-semibold text-gray-900">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@email.com"
                  className="h-12 text-base border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>

            <div className="space-y-2">
              <Label htmlFor="serviceType" className="text-base font-semibold text-gray-900">
                Service Type
              </Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger className="h-12 text-base border-gray-300 rounded-lg">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patio">Patio Installation</SelectItem>
                  <SelectItem value="deck">Deck Building</SelectItem>
                  <SelectItem value="fence">Fence Installation</SelectItem>
                  <SelectItem value="landscaping">Landscaping</SelectItem>
                  <SelectItem value="concrete">Concrete Work</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobAddress" className="text-base font-semibold text-gray-900">
                Job Address
              </Label>
              <Input
                id="jobAddress"
                value={jobAddress}
                onChange={(e) => setJobAddress(e.target.value)}
                placeholder="123 Main St, Austin, TX"
                className="h-12 text-base border-gray-300 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedValue" className="text-base font-semibold text-gray-900">
                Estimated Value ($)
              </Label>
              <Input
                id="estimatedValue"
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="5000"
                className="h-12 text-base border-gray-300 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold text-gray-900">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Project scope and details..."
                className="min-h-24 text-base border-gray-300 rounded-lg resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="px-8 h-12 text-base rounded-lg border-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="px-8 h-12 text-base bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              {isLoading ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
