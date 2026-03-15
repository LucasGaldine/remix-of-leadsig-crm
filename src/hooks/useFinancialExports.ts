import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";
import { toast } from "sonner";

export interface FinancialExport {
  id: string;
  account_id: string;
  created_by: string;
  filename: string;
  date_from: string;
  date_to: string;
  record_count: number;
  export_type: string;
  created_at: string;
}

export interface ExportRow {
  date: string;
  type: string;
  invoice_number: string;
  customer_name: string;
  job_name: string;
  description: string;
  subtotal: string;
  tax_rate: string;
  tax: string;
  discount: string;
  total: string;
  balance_due: string;
  payment_amount: string;
  payment_method: string;
  payment_status: string;
  status: string;
  crew_hours: string;
  job_cost_equipment: string;
  job_cost_materials: string;
  job_cost_labor: string;
  job_cost_other: string;
  job_cost_total: string;
}

export function useFinancialExportHistory() {
  const { user, currentAccount } = useAuth();

  return useQuery({
    queryKey: ["financial-exports", currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from("financial_exports")
        .select("*")
        .eq("account_id", currentAccount.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as FinancialExport[];
    },
    enabled: !!user && !!currentAccount,
  });
}

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCSV(rows: ExportRow[]): string {
  const headers = [
    "Date",
    "Type",
    "Invoice #",
    "Customer",
    "Job",
    "Description",
    "Subtotal",
    "Tax Rate (%)",
    "Tax",
    "Discount",
    "Total",
    "Balance Due",
    "Payment Amount",
    "Payment Method",
    "Payment Status",
    "Status",
    "Crew Hours",
    "Job Cost (Equipment)",
    "Job Cost (Materials)",
    "Job Cost (Labor)",
    "Job Cost (Other)",
    "Job Cost Total",
  ];

  const lines = [headers.map(escapeCSVField).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.type,
        row.invoice_number,
        row.customer_name,
        row.job_name,
        row.description,
        row.subtotal,
        row.tax_rate,
        row.tax,
        row.discount,
        row.total,
        row.balance_due,
        row.payment_amount,
        row.payment_method,
        row.payment_status,
        row.status,
        row.crew_hours,
        row.job_cost_equipment,
        row.job_cost_materials,
        row.job_cost_labor,
        row.job_cost_other,
        row.job_cost_total,
      ]
        .map(escapeCSVField)
        .join(",")
    );
  }

  return lines.join("\n");
}

export function useGenerateExport() {
  const { user, currentAccount } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) => {
      if (!currentAccount || !user) throw new Error("Not authenticated");

      const startStr = format(dateFrom, "yyyy-MM-dd");
      const endStr = format(dateTo, "yyyy-MM-dd");

      const [invoicesRes, paymentsRes, timeEntriesRes, jobLineItemsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select(`
            *,
            customer:customers(id, name),
            job:leads!invoices_lead_id_fkey(id, name),
            line_items:invoice_line_items(id, name, quantity, unit, unit_price, total)
          `)
          .eq("account_id", currentAccount.id)
          .gte("created_at", `${startStr}T00:00:00`)
          .lte("created_at", `${endStr}T23:59:59`),

        supabase
          .from("payments")
          .select(`
            *,
            customer:customers(id, name),
            job:leads(id, name)
          `)
          .eq("account_id", currentAccount.id)
          .gte("created_at", `${startStr}T00:00:00`)
          .lte("created_at", `${endStr}T23:59:59`),

        supabase
          .from("job_time_entries")
          .select("lead_id, clock_in, clock_out")
          .eq("account_id", currentAccount.id)
          .gte("clock_in", `${startStr}T00:00:00`)
          .lte("clock_in", `${endStr}T23:59:59`)
          .not("clock_out", "is", null),

        supabase
          .from("job_line_items")
          .select("lead_id, category, total")
          .eq("account_id", currentAccount.id),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (timeEntriesRes.error) throw timeEntriesRes.error;
      if (jobLineItemsRes.error) throw jobLineItemsRes.error;

      const invoices = invoicesRes.data || [];
      const payments = paymentsRes.data || [];
      const timeEntries = timeEntriesRes.data || [];
      const jobLineItems = jobLineItemsRes.data || [];

      const crewHoursByJob = new Map<string, number>();
      for (const entry of timeEntries) {
        const hours =
          (new Date(entry.clock_out!).getTime() - new Date(entry.clock_in).getTime()) /
          (1000 * 60 * 60);
        crewHoursByJob.set(
          entry.lead_id,
          (crewHoursByJob.get(entry.lead_id) || 0) + hours
        );
      }

      interface JobCostBreakdown {
        equipment: number;
        materials: number;
        labor: number;
        other: number;
        total: number;
      }
      const jobCostsByJob = new Map<string, JobCostBreakdown>();
      for (const item of jobLineItems) {
        const existing = jobCostsByJob.get(item.lead_id) || {
          equipment: 0, materials: 0, labor: 0, other: 0, total: 0,
        };
        const amount = Number(item.total);
        const cat = item.category as string;
        if (cat === "equipment") existing.equipment += amount;
        else if (cat === "materials") existing.materials += amount;
        else if (cat === "labor") existing.labor += amount;
        else existing.other += amount;
        existing.total += amount;
        jobCostsByJob.set(item.lead_id, existing);
      }

      const rows: ExportRow[] = [];

      for (const inv of invoices) {
        const customerName = (inv.customer as any)?.name || "";
        const jobName = (inv.job as any)?.name || "";
        const lineItems = (inv.line_items as any[]) || [];
        const description = lineItems.map((li: any) => `${li.name} x${li.quantity}`).join("; ");
        const leadId = inv.lead_id;
        const hours = leadId ? crewHoursByJob.get(leadId) : undefined;
        const costs = leadId ? jobCostsByJob.get(leadId) : undefined;

        rows.push({
          date: inv.created_at ? format(new Date(inv.created_at), "yyyy-MM-dd") : "",
          type: "Invoice",
          invoice_number: inv.invoice_number ? `INV-${String(inv.invoice_number).padStart(4, "0")}` : "",
          customer_name: customerName,
          job_name: jobName,
          description,
          subtotal: Number(inv.subtotal).toFixed(2),
          tax_rate: Number(inv.tax_rate).toFixed(2),
          tax: Number(inv.tax).toFixed(2),
          discount: Number(inv.discount).toFixed(2),
          total: Number(inv.total).toFixed(2),
          balance_due: Number(inv.balance_due).toFixed(2),
          payment_amount: "",
          payment_method: "",
          payment_status: "",
          status: inv.status,
          crew_hours: hours ? hours.toFixed(1) : "",
          job_cost_equipment: costs ? costs.equipment.toFixed(2) : "",
          job_cost_materials: costs ? costs.materials.toFixed(2) : "",
          job_cost_labor: costs ? costs.labor.toFixed(2) : "",
          job_cost_other: costs ? costs.other.toFixed(2) : "",
          job_cost_total: costs ? costs.total.toFixed(2) : "",
        });
      }

      for (const pmt of payments) {
        const customerName = (pmt.customer as any)?.name || "";
        const jobName = (pmt.job as any)?.name || "";
        const pmtLeadId = pmt.job_id;
        const pmtCosts = pmtLeadId ? jobCostsByJob.get(pmtLeadId) : undefined;

        rows.push({
          date: pmt.created_at ? format(new Date(pmt.created_at), "yyyy-MM-dd") : "",
          type: "Payment",
          invoice_number: "",
          customer_name: customerName,
          job_name: jobName,
          description: "",
          subtotal: "",
          tax_rate: "",
          tax: "",
          discount: "",
          total: "",
          balance_due: "",
          payment_amount: Number(pmt.amount).toFixed(2),
          payment_method: pmt.method,
          payment_status: pmt.status,
          status: "",
          crew_hours: "",
          job_cost_equipment: pmtCosts ? pmtCosts.equipment.toFixed(2) : "",
          job_cost_materials: pmtCosts ? pmtCosts.materials.toFixed(2) : "",
          job_cost_labor: pmtCosts ? pmtCosts.labor.toFixed(2) : "",
          job_cost_other: pmtCosts ? pmtCosts.other.toFixed(2) : "",
          job_cost_total: pmtCosts ? pmtCosts.total.toFixed(2) : "",
        });
      }

      rows.sort((a, b) => a.date.localeCompare(b.date));

      const csv = buildCSV(rows);
      const filename = `financial-export-${startStr}-to-${endStr}.csv`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const { error: insertError } = await supabase.from("financial_exports").insert({
        account_id: currentAccount.id,
        created_by: user.id,
        filename,
        date_from: startStr,
        date_to: endStr,
        record_count: rows.length,
        export_type: "full",
      });

      if (insertError) throw insertError;

      return { filename, recordCount: rows.length };
    },
    onSuccess: ({ filename, recordCount }) => {
      queryClient.invalidateQueries({ queryKey: ["financial-exports"] });
      toast.success(`Exported ${recordCount} records to ${filename}`);
    },
    onError: (error: Error) => {
      toast.error("Export failed: " + error.message);
    },
  });
}

export function useDeleteExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_exports")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-exports"] });
    },
  });
}
