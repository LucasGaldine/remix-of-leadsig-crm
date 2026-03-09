import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LineItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceRequest {
  jobId: string;
  lineItems: LineItem[];
  taxRate?: number;
  notes?: string;
  customerEmail?: string;
  customerName?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe is not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      throw new Error("No active account found");
    }

    const body: InvoiceRequest = await req.json();
    const { jobId, lineItems, taxRate, notes, customerEmail, customerName } = body;

    if (!jobId || !lineItems || lineItems.length === 0) {
      throw new Error("Missing required fields: jobId and lineItems");
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("leads")
      .select("id, name, customer_id, address")
      .eq("id", jobId)
      .eq("account_id", membership.account_id)
      .single();

    if (jobError || !job) {
      throw new Error("Job not found");
    }

    // Get Stripe connect account
    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_user_id || !stripeAccount.charges_enabled) {
      throw new Error("Stripe account not connected or not enabled for charges");
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
    const connectOpts = { stripeAccount: stripeAccount.stripe_user_id };

    // Create Stripe customer
    const stripeCustomer = await stripe.customers.create(
      {
        email: customerEmail || undefined,
        name: customerName || undefined,
        metadata: {
          supabase_customer_id: job.customer_id,
          account_id: membership.account_id,
        },
      },
      connectOpts
    );

    // Calculate totals
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
    const effectiveTaxRate = taxRate || 0;
    const tax = subtotal * effectiveTaxRate;
    const total = subtotal + tax;

    // Create invoice items in Stripe
    for (const item of lineItems) {
      const unitAmountCents = Math.round(item.unit_price * 100);
      await stripe.invoiceItems.create(
        {
          customer: stripeCustomer.id,
          description: item.description ? `${item.name} - ${item.description}` : item.name,
          quantity: Math.round(item.quantity),
          unit_amount: unitAmountCents,
          currency: "usd",
        },
        connectOpts
      );
    }

    // Build invoice params
    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: stripeCustomer.id,
      collection_method: "send_invoice",
      days_until_due: 30,
      auto_advance: true,
      pending_invoice_items_behavior: "include",
      metadata: { job_id: jobId, account_id: membership.account_id },
    };

    if (effectiveTaxRate > 0) {
      const taxRateObj = await stripe.taxRates.create(
        { display_name: "Tax", percentage: effectiveTaxRate * 100, inclusive: false },
        connectOpts
      );
      invoiceParams.default_tax_rates = [taxRateObj.id];
    }

    const stripeInvoice = await stripe.invoices.create(invoiceParams, connectOpts);
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id, {}, connectOpts);

    let hostedUrl = finalizedInvoice.hosted_invoice_url || null;
    try {
      const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id, {}, connectOpts);
      hostedUrl = sentInvoice.hosted_invoice_url || hostedUrl;
    } catch (sendErr) {
      console.warn("sendInvoice failed (non-fatal):", sendErr);
    }

    if (!hostedUrl) {
      const refreshed = await stripe.invoices.retrieve(finalizedInvoice.id, {}, connectOpts);
      hostedUrl = refreshed.hosted_invoice_url || null;
    }

    // Create local invoice record
    const { data: newInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        customer_id: job.customer_id,
        lead_id: jobId,
        subtotal,
        tax_rate: effectiveTaxRate,
        tax,
        discount: 0,
        total,
        balance_due: total,
        notes: notes || null,
        status: "sent",
        sent_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        created_by: user.id,
        account_id: membership.account_id,
        stripe_invoice_id: finalizedInvoice.id,
        stripe_invoice_url: hostedUrl,
      })
      .select("id")
      .single();

    if (invoiceError) {
      throw new Error("Failed to create local invoice record: " + invoiceError.message);
    }

    // Create local line items
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      await supabase.from("invoice_line_items").insert({
        invoice_id: newInvoice.id,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit: "item",
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        sort_order: i,
        account_id: membership.account_id,
      });
    }

    return new Response(
      JSON.stringify({
        invoiceId: newInvoice.id,
        stripeInvoiceId: finalizedInvoice.id,
        stripeInvoiceUrl: hostedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error creating Stripe invoice:", msg, error);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
