import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { decodeJwtPayload, extractBearerToken } from "../_shared/auth-header.ts";
import {
  buildPendingTerminalPaymentRecord,
  shouldRetryTerminalPaymentInsertWithoutTracking,
} from "../_shared/terminal-payment-record.ts";

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

interface TerminalPaymentRequest {
  amount: number;
  invoiceId?: string;
  customerId: string;
  jobId?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  channel?: string;
  paymentMethod?: string;
}

async function cleanupCreatedInvoice(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) {
    console.error("Failed to clean up Tap to Pay invoice:", error);
  }
}

async function createDraftInvoiceForTerminalPayment(params: {
  supabase: ReturnType<typeof createClient>;
  accountId: string;
  userId: string;
  customerId: string;
  jobId: string;
  amount: number;
  description?: string;
}): Promise<string> {
  const { supabase, accountId, userId, customerId, jobId, amount, description } = params;

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();

  if (estimateError) {
    console.error("Tap to Pay estimate lookup failed:", {
      message: estimateError.message,
      details: estimateError.details,
      hint: estimateError.hint,
      code: estimateError.code,
      jobId,
    });
  }

  const invoiceNumber = await supabase.rpc("get_next_invoice_number", {
    p_account_id: accountId,
  });

  if (invoiceNumber.error) {
    console.error("Tap to Pay invoice number lookup failed:", {
      message: invoiceNumber.error.message,
      details: invoiceNumber.error.details,
      hint: invoiceNumber.error.hint,
      code: invoiceNumber.error.code,
      accountId,
    });
    throw new HttpError(500, `Failed to get next invoice number: ${invoiceNumber.error.message}`);
  }

  const dueDate = new Date().toISOString().split("T")[0];

  const { data: newInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      customer_id: customerId,
      lead_id: jobId,
      estimate_id: estimate?.id || null,
      invoice_number: invoiceNumber.data || 1,
      subtotal: amount,
      tax_rate: 0,
      tax: 0,
      discount: 0,
      total: amount,
      balance_due: amount,
      notes: description || "Tap to Pay payment in progress",
      status: "draft",
      due_date: dueDate,
      created_by: userId,
      account_id: accountId,
    })
    .select("id")
    .single();

  if (invoiceError || !newInvoice?.id) {
    console.error("Tap to Pay invoice insert failed:", {
      message: invoiceError?.message,
      details: invoiceError?.details,
      hint: invoiceError?.hint,
      code: invoiceError?.code,
      accountId,
      userId,
      customerId,
      jobId,
      estimateId: estimate?.id || null,
      amount,
    });
    throw new HttpError(
      500,
      `Failed to create Tap to Pay invoice: ${invoiceError?.message || "unknown insert error"}`,
    );
  }

  const { error: lineItemError } = await supabase
    .from("invoice_line_items")
    .insert({
      invoice_id: newInvoice.id,
      name: description || "Tap to Pay payment",
      description: description || "Tap to Pay payment in progress",
      quantity: 1,
      unit: "item",
      unit_price: amount,
      total: amount,
      sort_order: 0,
      account_id: accountId,
    });

  if (lineItemError) {
    console.error("Tap to Pay invoice line item insert failed:", {
      message: lineItemError.message,
      details: lineItemError.details,
      hint: lineItemError.hint,
      code: lineItemError.code,
      invoiceId: newInvoice.id,
      accountId,
    });
    await cleanupCreatedInvoice(supabase, newInvoice.id);
    throw new HttpError(
      500,
      `Failed to create Tap to Pay invoice line item: ${lineItemError.message}`,
    );
  }

  return newInvoice.id;
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
    if (!authHeader) {
      throw new HttpError(401, "Missing authorization");
    }

    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new HttpError(401, "Missing authorization");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    const fallbackClaims = decodeJwtPayload(token);
    const resolvedUserId = user?.id || (typeof fallbackClaims?.sub === "string" ? fallbackClaims.sub : null);
    if (!resolvedUserId) {
      console.error("Terminal create payment auth failed:", userError?.message || "No user found");
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

    const body: TerminalPaymentRequest = await req.json();
    const { amount, invoiceId, customerId, jobId, customerEmail, description, channel, paymentMethod } = body;

    if (!amount || !customerId) {
      throw new HttpError(400, "Missing required fields: amount, customerId");
    }

    if (!invoiceId && !jobId) {
      throw new HttpError(400, "Tap to Pay requires either an invoiceId or jobId");
    }

    if (channel && channel !== "terminal") {
      throw new HttpError(400, "Tap to Pay payments must use the terminal channel");
    }

    if (paymentMethod && paymentMethod !== "tap-to-pay") {
      throw new HttpError(400, "Tap to Pay payments must use the tap-to-pay payment method");
    }

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_user_id || !stripeAccount.charges_enabled) {
      throw new HttpError(400, "Stripe account not connected or not enabled for charges");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card_present"],
        capture_method: "automatic",
        metadata: {
          customer_id: customerId,
          account_id: membership.account_id,
          ...(invoiceId ? { invoice_id: invoiceId } : {}),
          ...(jobId ? { lead_id: jobId } : {}),
        },
        description: description || "Tap to Pay payment",
        receipt_email: customerEmail,
      },
      { stripeAccount: stripeAccount.stripe_user_id },
    );

    let resolvedInvoiceId = invoiceId;
    let createdInvoiceId: string | null = null;

    if (!resolvedInvoiceId) {
      resolvedInvoiceId = await createDraftInvoiceForTerminalPayment({
        supabase,
        accountId: membership.account_id,
        userId: resolvedUserId,
        customerId,
        jobId: jobId!,
        amount,
        description,
      });
      createdInvoiceId = resolvedInvoiceId;
    }

    await stripe.paymentIntents.update(
      paymentIntent.id,
      {
        metadata: {
          customer_id: customerId,
          account_id: membership.account_id,
          invoice_id: resolvedInvoiceId,
          ...(jobId ? { lead_id: jobId } : {}),
        },
      },
      { stripeAccount: stripeAccount.stripe_user_id },
    );

    const paymentInsertInput = {
      invoiceId: resolvedInvoiceId,
      customerId,
      jobId,
      accountId: membership.account_id,
      amount,
      stripePaymentIntentId: paymentIntent.id,
      stripeAccountId: stripeAccount.stripe_user_id,
      stripeTerminalPaymentIntentStatus: paymentIntent.status,
      processedBy: resolvedUserId,
    };

    let paymentInsert = await supabase
      .from("payments")
      .insert(buildPendingTerminalPaymentRecord(paymentInsertInput))
      .select("id")
      .single();

    if (
      paymentInsert.error &&
      shouldRetryTerminalPaymentInsertWithoutTracking(paymentInsert.error.message)
    ) {
      console.warn("Retrying terminal payment insert without tracking columns:", paymentInsert.error.message);
      paymentInsert = await supabase
        .from("payments")
        .insert(buildPendingTerminalPaymentRecord(paymentInsertInput, false))
        .select("id")
        .single();
    }

    const { data: paymentRecord, error: paymentError } = paymentInsert;

    if (paymentError) {
      console.error("Tap to Pay payment insert failed:", {
        message: paymentError.message,
        details: paymentError.details,
        hint: paymentError.hint,
        code: paymentError.code,
        invoiceId: resolvedInvoiceId,
        customerId,
        jobId,
        accountId: membership.account_id,
      });
      if (createdInvoiceId) {
        await cleanupCreatedInvoice(supabase, createdInvoiceId);
      }
      throw new HttpError(500, `Failed to create pending payment record: ${paymentError.message}`);
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        invoiceId: resolvedInvoiceId,
        paymentIntentId: paymentIntent.id,
        paymentId: paymentRecord?.id ?? null,
        channel: "terminal",
        paymentMethod: "tap-to-pay",
        status: "terminal_pending",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error creating Stripe Terminal payment session:", error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      },
    );
  }
});
