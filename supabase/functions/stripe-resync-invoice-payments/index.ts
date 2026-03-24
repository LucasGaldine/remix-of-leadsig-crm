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

interface OfflinePaymentInput {
  id: string;
  amount: number;
  method: string;
  status: string;
}

interface ResyncInvoicePaymentsRequest {
  invoiceId: string;
  payments: OfflinePaymentInput[];
}

function roundCurrencyAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) {
      throw new HttpError(401, "Missing authorization");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    const fallbackClaims = decodeJwtPayload(token);
    const resolvedUserId = user?.id || (typeof fallbackClaims?.sub === "string" ? fallbackClaims.sub : null);

    if (!resolvedUserId) {
      console.error("Stripe invoice resync auth failed:", userError?.message || "No user found");
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

    const body: ResyncInvoicePaymentsRequest = await req.json();

    if (!body.invoiceId) {
      throw new HttpError(400, "Missing required field: invoiceId");
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, total, balance_due, stripe_invoice_id, account_id")
      .eq("id", body.invoiceId)
      .eq("account_id", membership.account_id)
      .single();

    if (invoiceError || !invoice) {
      throw new HttpError(404, "Invoice not found");
    }

    if (!invoice.stripe_invoice_id) {
      throw new HttpError(400, "Invoice is not connected to Stripe");
    }

    const completedOfflinePayments = (body.payments || []).filter((payment) =>
      payment.status === "completed" && ["cash", "check", "ach"].includes(payment.method),
    );

    if (completedOfflinePayments.length === 0) {
      throw new HttpError(400, "No completed offline payments found to resend");
    }

    const totalOfflinePayments = roundCurrencyAmount(
      completedOfflinePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
    const invoiceTotal = roundCurrencyAmount(Number(invoice.total || 0));

    if (totalOfflinePayments < invoiceTotal) {
      throw new HttpError(400, "Logged offline payments do not fully cover this Stripe invoice yet");
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

    const stripeInvoice = await stripe.invoices.retrieve(
      invoice.stripe_invoice_id,
      {},
      { stripeAccount: stripeAccount.stripe_user_id },
    );

    if (stripeInvoice.status === "paid") {
      return new Response(
        JSON.stringify({ success: true, alreadyPaid: true }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    await stripe.invoices.pay(
      invoice.stripe_invoice_id,
      { paid_out_of_band: true },
      { stripeAccount: stripeAccount.stripe_user_id },
    );

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
