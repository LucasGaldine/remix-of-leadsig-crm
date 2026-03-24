import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

import { decodeJwtPayload, extractBearerToken } from "../_shared/auth-header.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface OfflineInvoicePaymentRequest {
  invoiceId: string;
  amount: number;
  method: string;
}

function roundCurrencyAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMethodLabel(method: string) {
  return method === "ach"
    ? "ACH"
    : method.charAt(0).toUpperCase() + method.slice(1);
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
      throw new HttpError(400, "Stripe is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new HttpError(401, "Missing authorization");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    const fallbackClaims = decodeJwtPayload(token);
    const resolvedUserId = user?.id || (typeof fallbackClaims?.sub === "string" ? fallbackClaims.sub : null);

    if (!resolvedUserId) {
      console.error("Offline Stripe invoice payment auth failed:", userError?.message || "No user found");
      throw new HttpError(401, "Unauthorized");
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", resolvedUserId)
      .eq("is_active", true)
      .single();

    if (!membership) {
      throw new HttpError(400, "No active account found");
    }

    const body: OfflineInvoicePaymentRequest = await req.json();
    const normalizedAmount = roundCurrencyAmount(Number(body.amount || 0));

    if (!body.invoiceId || !normalizedAmount || normalizedAmount <= 0 || !body.method) {
      throw new HttpError(400, "Missing required fields: invoiceId, amount, and method");
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, customer_id, lead_id, account_id, balance_due, stripe_invoice_id, status")
      .eq("id", body.invoiceId)
      .eq("account_id", membership.account_id)
      .single();

    if (invoiceError || !invoice) {
      throw new HttpError(404, "Invoice not found");
    }

    if (!invoice.stripe_invoice_id) {
      throw new HttpError(400, "Invoice is not connected to Stripe");
    }

    const normalizedBalanceDue = roundCurrencyAmount(Number(invoice.balance_due || 0));
    if (normalizedAmount !== normalizedBalanceDue) {
      throw new HttpError(400, "Stripe invoice offline payments must match the remaining balance");
    }

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("stripe_user_id, charges_enabled")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount?.stripe_user_id || !stripeAccount.charges_enabled) {
      throw new HttpError(400, "Stripe account not connected or not enabled for charges");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    await stripe.invoices.pay(
      invoice.stripe_invoice_id,
      {
        paid_out_of_band: true,
      },
      {
        stripeAccount: stripeAccount.stripe_user_id,
      },
    );

    const paidAt = new Date().toISOString();
    const methodLabel = formatMethodLabel(body.method);

    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        lead_id: invoice.lead_id,
        amount: normalizedAmount,
        method: body.method,
        status: "completed",
        processed_by: resolvedUserId,
        account_id: invoice.account_id,
        transaction_ref: invoice.stripe_invoice_id,
        notes: `Payment received via ${methodLabel} and synced to Stripe`,
      });

    if (paymentError) {
      console.error("Failed to create offline Stripe payment record:", paymentError);
      throw new HttpError(500, "Stripe invoice was paid, but LeadSig failed to record the payment");
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        balance_due: 0,
        status: "paid",
        paid_at: paidAt,
      })
      .eq("id", invoice.id);

    if (updateError) {
      console.error("Failed to update offline Stripe invoice status:", updateError);
      throw new HttpError(500, "Stripe invoice was paid, but LeadSig failed to update the invoice");
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
