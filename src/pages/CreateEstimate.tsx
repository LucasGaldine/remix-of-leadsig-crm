// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface LineItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface Job {
  id: string;
  name: string;
  customer_id: string;
  customer: {
    name: string;
  };
  has_estimate: boolean;
}

export default function CreateEstimate() {
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [taxRate, setTaxRate] = useState(
    String(currentAccount?.default_tax_rate ?? 8)
  );
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      quantity: 1,
      unit: "each",
      unit_price: 0,
      total: 0,
    },
  ]);

  useEffect(() => {
    fetchJobsWithoutEstimates();
  }, [currentAccount]);

  const fetchJobsWithoutEstimates = async () => {
    if (!currentAccount) return;

    setJobsLoading(true);
    try {
      const { data: jobsData, error: jobsError } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          customer_id,
          customer:customers!customer_id(name)
        `)
        .eq("account_id", currentAccount.id)
        .in("status", ["job", "paid", "completed"])
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      const { data: estimatesData, error: estimatesError } = await supabase
        .from("estimates")
        .select("job_id")
        .eq("account_id", currentAccount.id);

      if (estimatesError) throw estimatesError;

      const jobIdsWithEstimates = new Set(estimatesData.map(e => e.job_id));

      const jobsWithoutEstimates = (jobsData || [])
        .filter(job => !jobIdsWithEstimates.has(job.id))
        .map(job => ({
          ...job,
          has_estimate: false,
        }));

      setJobs(jobsWithoutEstimates);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setJobsLoading(false);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        quantity: 1,
        unit: "each",
        unit_price: 0,
        total: 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      toast.error("You must have at least one line item");
      return;
    }
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          if (field === "quantity" || field === "unit_price") {
            updated.total = Number(updated.quantity) * Number(updated.unit_price);
          }

          return updated;
        }
        return item;
      })
    );
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (parseFloat(taxRate) / 100);
    const discountAmount = parseFloat(discount) || 0;
    const total = subtotal + taxAmount - discountAmount;

    return { subtotal, taxAmount, discountAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !currentAccount) {
      toast.error("You must be logged in");
      return;
    }

    if (!selectedJobId) {
      toast.error("Please select a job");
      return;
    }

    if (lineItems.length === 0 || lineItems.every(item => !item.name)) {
      toast.error("Please add at least one line item");
      return;
    }

    setIsLoading(true);

    try {
      const selectedJob = jobs.find(j => j.id === selectedJobId);
      if (!selectedJob) {
        throw new Error("Selected job not found");
      }

      const { subtotal, taxAmount, discountAmount, total } = calculateTotals();

      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          customer_id: selectedJob.customer_id,
          job_id: selectedJobId,
          account_id: currentAccount.id,
          subtotal,
          profit_margin: currentAccount?.default_profit_margin ?? 0,
          tax_rate: parseFloat(taxRate) / 100,
          tax: taxAmount,
          discount: discountAmount,
          total,
          notes,
          status: "draft",
          expires_at: expiresAt || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (estimateError) throw estimateError;

      const lineItemsToInsert = lineItems
        .filter(item => item.name)
        .map((item, index) => ({
          estimate_id: estimate.id,
          account_id: currentAccount.id,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total: item.total,
          sort_order: index,
        }));

      if (lineItemsToInsert.length > 0) {
        const { error: lineItemsError } = await supabase
          .from("estimate_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) throw lineItemsError;
      }

      toast.success("Estimate created successfully!");
      navigate(`/estimate/${estimate.id}`);
    } catch (error) {
      console.error("Error creating estimate:", error);
      toast.error("Failed to create estimate");
    } finally {
      setIsLoading(false);
    }
  };

  const { subtotal, taxAmount, discountAmount, total } = calculateTotals();

  if (jobsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          title="Create Estimate"
          icon={<FileText className="h-6 w-6" />}
          backTo="/payments"
        />
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          title="Create Estimate"
          icon={<FileText className="h-6 w-6" />}
          backTo="/payments"
        />
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Jobs Available
                </h3>
                <p className="text-gray-500 mb-6">
                  All your jobs already have estimates. Create a new job first to generate an estimate.
                </p>
                <Button onClick={() => navigate("/jobs")}>
                  Go to Jobs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Create Estimate"
        icon={<FileText className="h-6 w-6" />}
        backTo="/payments"
      />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estimate Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="job">
                  Select Job <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger id="job">
                    <SelectValue placeholder="Choose a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name ? `${job.name} - ${job.customer.name}` : job.customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  Each job can only have one estimate
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expiration Date</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for the customer..."
                  className="min-h-24"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <Card key={item.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-700">Item {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Item Name *</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateLineItem(item.id, "name", e.target.value)}
                            placeholder="Labor, Materials, etc."
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            placeholder="Item description..."
                            className="min-h-20"
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Unit</Label>
                            <Select
                              value={item.unit}
                              onValueChange={(value) => updateLineItem(item.id, "unit", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="each">Each</SelectItem>
                                <SelectItem value="hour">Hour</SelectItem>
                                <SelectItem value="sq ft">Sq Ft</SelectItem>
                                <SelectItem value="linear ft">Linear Ft</SelectItem>
                                <SelectItem value="day">Day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Unit Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Total</Label>
                            <Input
                              type="text"
                              value={`$${item.total.toFixed(2)}`}
                              disabled
                              className="bg-gray-50"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <Label htmlFor="taxRate" className="text-gray-600">Tax Rate (%):</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-24"
                  />
                  <span className="font-semibold min-w-[100px] text-right">${taxAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center gap-4">
                <Label htmlFor="discount" className="text-gray-600">Discount ($):</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-24"
                  />
                  <span className="font-semibold min-w-[100px] text-right">-${discountAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-2xl">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className="font-bold text-emerald-700">${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/payments")}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {isLoading ? "Creating..." : "Create Estimate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
