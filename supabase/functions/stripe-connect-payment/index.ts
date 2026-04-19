import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentRequest {
  amount: number;
  invoiceId: string;
  customerId: string;
  jobId?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({
          error: "Stripe is not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
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

    const body: PaymentRequest = await req.json();
    const { amount, invoiceId, customerId, customerEmail, customerName, description } = body;

    if (!amount || !invoiceId || !customerId) {
      throw new Error("Missing required fields: amount, invoiceId, customerId");
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, customer_id, account_id, lead_id, balance_due, invoice_number")
      .eq("id", invoiceId)
      .eq("account_id", membership.account_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    if (!invoice.customer_id) {
      throw new Error("Invoice must have a customer");
    }

    const remainingBalance = Number(invoice.balance_due || 0);
    if (remainingBalance <= 0) {
      throw new Error("Invoice has no remaining balance to charge");
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

    const amountInCents = Math.round(amount * 100);
    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "http://localhost:5173";
    const successUrl = `${origin}/payments?charge=success&invoice=${encodeURIComponent(invoiceId)}`;
    const cancelUrl = `${origin}/?charge=canceled&invoice=${encodeURIComponent(invoiceId)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number ? `#${invoice.invoice_number}` : invoice.id}`,
              description: description || "In-person card payment",
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          invoice_id: invoiceId,
          customer_id: invoice.customer_id,
          account_id: membership.account_id,
          ...(invoice.lead_id ? { lead_id: invoice.lead_id } : {}),
        },
        description: description || `Payment for invoice ${invoiceId}`,
        receipt_email: customerEmail || undefined,
        transfer_data: {
          destination: stripeAccount.stripe_user_id,
        },
      },
      metadata: {
        invoice_id: invoiceId,
        customer_id: invoice.customer_id,
        account_id: membership.account_id,
        ...(invoice.lead_id ? { lead_id: invoice.lead_id } : {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        checkoutSessionId: session.id,
        customerName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating payment session:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
