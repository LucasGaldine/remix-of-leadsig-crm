import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceRequest {
  invoiceId: string;
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
    const { invoiceId, customerEmail, customerName } = body;

    if (!invoiceId) {
      throw new Error("Missing required field: invoiceId");
    }

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select(`
        id, subtotal, tax_rate, tax, discount, total, notes, lead_id, customer_id, account_id, estimate_id, due_date,
        line_items:invoice_line_items(
          id, name, description, quantity, unit, unit_price, total, sort_order
        )
      `)
      .eq("id", invoiceId)
      .eq("account_id", membership.account_id)
      .single();

    if (invError || !invoice) {
      throw new Error("Invoice not found");
    }

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_user_id || !stripeAccount.charges_enabled) {
      throw new Error("Stripe account not connected or not enabled for charges");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const connectOpts = { stripeAccount: stripeAccount.stripe_user_id };

    const stripeCustomer = await stripe.customers.create(
      {
        email: customerEmail || undefined,
        name: customerName || undefined,
        metadata: {
          supabase_customer_id: invoice.customer_id,
          account_id: membership.account_id,
        },
      },
      connectOpts
    );

    const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const daysUntilDue = Math.max(1, Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: stripeCustomer.id,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      auto_advance: true,
      pending_invoice_items_behavior: "include",
      metadata: {
        invoice_id: invoiceId,
        estimate_id: invoice.estimate_id,
        account_id: membership.account_id,
      },
    };

    if (Number(invoice.tax_rate) > 0) {
      const taxRate = await stripe.taxRates.create(
        {
          display_name: "Tax",
          percentage: Number(invoice.tax_rate) * 100,
          inclusive: false,
        },
        connectOpts
      );
      invoiceParams.default_tax_rates = [taxRate.id];
    }

    for (const item of invoice.line_items || []) {
      const unitAmountCents = Math.round(Number(item.unit_price) * 100);
      await stripe.invoiceItems.create(
        {
          customer: stripeCustomer.id,
          description: item.description
            ? `${item.name} - ${item.description}`
            : item.name,
          quantity: Math.round(Number(item.quantity)),
          unit_amount: unitAmountCents,
          currency: "usd",
        },
        connectOpts
      );
    }

    const stripeInvoice = await stripe.invoices.create(invoiceParams, connectOpts);

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      stripeInvoice.id,
      {},
      connectOpts
    );

    let hostedUrl = finalizedInvoice.hosted_invoice_url || null;

    try {
      const sentInvoice = await stripe.invoices.sendInvoice(
        finalizedInvoice.id,
        {},
        connectOpts
      );
      hostedUrl = sentInvoice.hosted_invoice_url || hostedUrl;
    } catch (sendErr) {
      console.warn("sendInvoice failed (non-fatal):", sendErr);
    }

    if (!hostedUrl) {
      const refreshed = await stripe.invoices.retrieve(
        finalizedInvoice.id,
        {},
        connectOpts
      );
      hostedUrl = refreshed.hosted_invoice_url || null;
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        stripe_invoice_id: finalizedInvoice.id,
        stripe_invoice_url: hostedUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (updateError) {
      throw new Error("Failed to update invoice with Stripe details: " + updateError.message);
    }

    return new Response(
      JSON.stringify({
        invoiceId: invoice.id,
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
