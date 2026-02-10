import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceRequest {
  estimateId: string;
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
    const { estimateId, customerEmail, customerName } = body;

    if (!estimateId) {
      throw new Error("Missing required field: estimateId");
    }

    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .select(`
        id, subtotal, tax_rate, tax, discount, total, notes, job_id, customer_id, account_id,
        line_items:estimate_line_items(
          id, name, description, quantity, unit, unit_price, total, sort_order,
          is_change_order, change_order_type
        )
      `)
      .eq("id", estimateId)
      .eq("account_id", membership.account_id)
      .single();

    if (estError || !estimate) {
      throw new Error("Estimate not found");
    }

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_account_id || !stripeAccount.charges_enabled) {
      throw new Error("Stripe account not connected or not enabled for charges");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const stripeCustomer = await stripe.customers.create(
      {
        email: customerEmail || undefined,
        name: customerName || undefined,
        metadata: {
          supabase_customer_id: estimate.customer_id,
          account_id: membership.account_id,
        },
      },
      { stripeAccount: stripeAccount.stripe_account_id }
    );

    const activeLineItems = (estimate.line_items || []).filter(
      (li: any) => !li.is_change_order || li.change_order_type !== "deleted"
    );

    for (const item of activeLineItems) {
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
        { stripeAccount: stripeAccount.stripe_account_id }
      );
    }

    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: stripeCustomer.id,
      collection_method: "send_invoice",
      days_until_due: 30,
      auto_advance: true,
      metadata: {
        estimate_id: estimateId,
        account_id: membership.account_id,
      },
    };

    if (Number(estimate.tax_rate) > 0) {
      const taxRate = await stripe.taxRates.create(
        {
          display_name: "Tax",
          percentage: Number(estimate.tax_rate) * 100,
          inclusive: false,
        },
        { stripeAccount: stripeAccount.stripe_account_id }
      );
      invoiceParams.default_tax_rates = [taxRate.id];
    }

    const stripeInvoice = await stripe.invoices.create(
      invoiceParams,
      { stripeAccount: stripeAccount.stripe_account_id }
    );

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      stripeInvoice.id,
      {},
      { stripeAccount: stripeAccount.stripe_account_id }
    );

    await stripe.invoices.sendInvoice(
      finalizedInvoice.id,
      {},
      { stripeAccount: stripeAccount.stripe_account_id }
    );

    const hostedUrl = finalizedInvoice.hosted_invoice_url;

    const { data: newInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        customer_id: estimate.customer_id,
        lead_id: estimate.job_id,
        estimate_id: estimate.id,
        subtotal: estimate.subtotal,
        tax_rate: estimate.tax_rate,
        tax: estimate.tax,
        discount: estimate.discount,
        total: estimate.total,
        balance_due: estimate.total,
        notes: estimate.notes,
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

    for (const item of activeLineItems) {
      await supabase.from("invoice_line_items").insert({
        invoice_id: newInvoice.id,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total: item.total,
        sort_order: item.sort_order || 0,
        account_id: membership.account_id,
      });
    }

    await supabase
      .from("estimates")
      .update({ is_finalized: true, updated_at: new Date().toISOString() })
      .eq("id", estimateId);

    return new Response(
      JSON.stringify({
        invoiceId: newInvoice.id,
        stripeInvoiceId: finalizedInvoice.id,
        stripeInvoiceUrl: hostedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error creating Stripe invoice:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
