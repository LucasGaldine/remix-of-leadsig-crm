import { useState } from "react";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useCreateCustomer, type Customer, type CreateCustomerInput } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { ClientSelector } from "@/components/clients/ClientSelector";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { resolveCreateJobAddress } from "@/lib/createJobAddress";
import { buildDefaultJobName } from "@/lib/defaultJobName";
import { JobCSVImportModal } from "@/components/jobs/JobCSVImportModal";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INITIAL_CLIENT_DATA: CreateCustomerInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
};

export function CreateJobDialog({ open, onOpenChange }: CreateJobDialogProps) {
  const createCustomerMutation = useCreateCustomer();
  const createJob = useCreateJob();

  const [showCSVImport, setShowCSVImport] = useState(false);

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newClientData, setNewClientData] = useState<CreateCustomerInput>({ ...INITIAL_CLIENT_DATA });

  const [jobName, setJobName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resolveCustomer = async (): Promise<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  }> => {
    if (clientMode === "new") {
      const customer = await createCustomerMutation.mutateAsync({
        name: newClientData.name.trim(),
        phone: newClientData.phone?.trim() || null,
        email: newClientData.email?.trim() || null,
        address: newClientData.address?.trim() || null,
        city: newClientData.city?.trim() || null,
      });

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      };
    }

    if (clientMode === "existing" && selectedCustomer) {
      return {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email,
        address: selectedCustomer.address,
      };
    }

    throw new Error("Please select a client or create a new one");
  };

  const resetForm = () => {
    setClientMode("existing");
    setSelectedCustomer(null);
    setNewClientData({ ...INITIAL_CLIENT_DATA });
    setJobName("");
    setServiceType("");
    setJobAddress("");
    setDescription("");
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (clientMode === "new" && !newClientData.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (clientMode === "existing" && !selectedCustomer) {
      toast.error("Please select a client or create a new one");
      return;
    }

    setIsLoading(true);

    try {
      const customer = await resolveCustomer();
      const resolvedAddress = resolveCreateJobAddress({
        jobAddress,
        customerAddress: customer.address,
      });

      await createJob.mutateAsync({
        name: jobName.trim() || buildDefaultJobName({
          customerName: customer.name,
          serviceType,
        }),
        customer_id: customer.id,
        phone: customer.phone,
        email: customer.email,
        service_type: serviceType || null,
        address: resolvedAddress,
        description: description || null,
        status: "job",
      });

      toast.success("Job created successfully!");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating job:", error);
      toast.error("Failed to create job. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <JobCSVImportModal
        open={showCSVImport}
        onOpenChange={setShowCSVImport}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
          </DialogHeader>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 mt-2"
            onClick={() => {
              onOpenChange(false);
              setShowCSVImport(true);
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <ClientSelector
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
              newClientData={newClientData}
              onNewClientDataChange={setNewClientData}
              mode={clientMode}
              onModeChange={setClientMode}
            />

            <div className="flex items-center gap-3">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Optional
              </span>
              <div className="h-px bg-border flex-1" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobName">Job Name</Label>
              <Input
                id="jobName"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Smith Patio Project"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger id="serviceType" className="h-12 text-base border-border rounded-lg">
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

            <div className="space-y-2">
              <Label htmlFor="jobAddress">Job Address</Label>
              <Input
                id="jobAddress"
                value={jobAddress}
                onChange={(e) => setJobAddress(e.target.value)}
                placeholder={selectedCustomer?.address ? `Default: ${selectedCustomer.address}` : "123 Main St, Austin, TX"}
              />
              {selectedCustomer?.address && !jobAddress && (
                <p className="text-xs text-muted-foreground">
                  Will use client's address: {selectedCustomer.address}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Project scope and details..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? "Creating..." : "Create Job"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
