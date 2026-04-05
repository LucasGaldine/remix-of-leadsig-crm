import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const QUICKBOOKS_BASE_URL = "https://quickbooks.api.intuit.com";

type QuickBooksIntegration = {
  account_id: string;
  realm_id: string;
  access_token: string;
};

type LeadSigPayment = {
  id: string;
  amount: number | string;
  created_at: string;
  method: string | null;
  transaction_ref: string | null;
  customer: { name: string | null } | null;
};

function escapeQuickBooksQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function quickBooksRequest<T>(
  integration: QuickBooksIntegration,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${QUICKBOOKS_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${integration.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    const message =
      data?.Fault?.Error?.[0]?.Detail ||
      data?.Fault?.Error?.[0]?.Message ||
      `QuickBooks request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function findOrCreateCustomer(
  integration: QuickBooksIntegration,
  customerName: string,
): Promise<string> {
  const escapedName = escapeQuickBooksQueryValue(customerName);
  const query = encodeURIComponent(`select Id from Customer where DisplayName = '${escapedName}'`);

  const existing = await quickBooksRequest<{
    QueryResponse?: { Customer?: Array<{ Id: string }> };
  }>(integration, `/v3/company/${integration.realm_id}/query?query=${query}&minorversion=75`);

  const existingCustomerId = existing.QueryResponse?.Customer?.[0]?.Id;
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const created = await quickBooksRequest<{
    Customer: { Id: string };
  }>(integration, `/v3/company/${integration.realm_id}/customer?minorversion=75`, {
    method: "POST",
    body: JSON.stringify({
      DisplayName: customerName.slice(0, 100),
    }),
  });

  return created.Customer.Id;
}

async function paymentAlreadyExported(
  integration: QuickBooksIntegration,
  paymentRefNum: string,
): Promise<boolean> {
  const escapedRefNum = escapeQuickBooksQueryValue(paymentRefNum);
  const query = encodeURIComponent(`select Id from Payment where PaymentRefNum = '${escapedRefNum}'`);

  const existing = await quickBooksRequest<{
    QueryResponse?: { Payment?: Array<{ Id: string }> };
  }>(integration, `/v3/company/${integration.realm_id}/query?query=${query}&minorversion=75`);

  return Boolean(existing.QueryResponse?.Payment?.[0]?.Id);
}

async function exportPaymentToQuickBooks(
  integration: QuickBooksIntegration,
  payment: LeadSigPayment,
): Promise<"exported" | "skipped"> {
  const customerName = payment.customer?.name?.trim() || "LeadSig Customer";
  const paymentRefNum = `LSIG-PMT-${payment.id.slice(0, 16)}`;

  const alreadyExported = await paymentAlreadyExported(integration, paymentRefNum);
  if (alreadyExported) {
    return "skipped";
  }

  const customerId = await findOrCreateCustomer(integration, customerName);

  await quickBooksRequest(
    integration,
    `/v3/company/${integration.realm_id}/payment?minorversion=75`,
    {
      method: "POST",
      body: JSON.stringify({
        CustomerRef: { value: customerId },
        TotalAmt: Number(payment.amount),
        TxnDate: payment.created_at.slice(0, 10),
        PrivateNote: `LeadSig Payment ID: ${payment.id}`,
        PaymentRefNum: payment.transaction_ref || paymentRefNum,
      }),
    },
  );

  return "exported";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership?.account_id) {
      throw new Error("No active account found");
    }

    const { dateFrom, dateTo } = await req.json();

    if (!dateFrom || !dateTo) {
      throw new Error("dateFrom and dateTo are required");
    }

    const { data: integration, error: integrationError } = await supabase
      .from("quickbooks_integrations")
      .select("account_id, realm_id, access_token")
      .eq("account_id", membership.account_id)
      .single();

    if (integrationError || !integration) {
      throw new Error("QuickBooks is not connected for this account");
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        id,
        amount,
        created_at,
        method,
        transaction_ref,
        customer:customers(name)
      `)
      .eq("account_id", membership.account_id)
      .eq("status", "completed")
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`)
      .order("created_at", { ascending: true });

    if (paymentsError) {
      throw paymentsError;
    }

    const typedPayments = (payments || []) as LeadSigPayment[];

    let exportedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ paymentId: string; message: string }> = [];

    for (const payment of typedPayments) {
      try {
        const result = await exportPaymentToQuickBooks(integration as QuickBooksIntegration, payment);
        if (result === "exported") {
          exportedCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        errors.push({
          paymentId: payment.id,
          message: error instanceof Error ? error.message : "Unknown export error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        exportedCount,
        skippedCount,
        failedCount: errors.length,
        errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("quickbooks-export-payments error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
