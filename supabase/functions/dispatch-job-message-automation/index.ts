import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type QueueEvent = {
  id: string;
  account_id: string;
  lead_id: string;
  endpoint_url: string;
  auth_header_name: string | null;
  auth_header_value: string | null;
  payload: Record<string, unknown>;
  message_rendered: string;
  trigger_source: string;
  status: "queued" | "retry_pending" | "processing" | "sent" | "failed";
  attempt_count: number;
  max_attempts: number;
  backoff_minutes: number;
};

function asJson(body: unknown) {
  return JSON.stringify(body);
}

function responseBodySnippet(text: string) {
  return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(asJson({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(asJson({ error: "Missing Supabase credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json().catch(() => ({}));
    const requestedLimit = Number((payload as Record<string, unknown>)?.limit);
    const batchSize = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 25;
    const nowIso = new Date().toISOString();

    const { data: queuedRows, error: queuedError } = await supabase
      .from("message_automation_events")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(batchSize);

    if (queuedError) {
      console.error("dispatch-job-message-automation: failed to load queued rows", queuedError);
      return new Response(asJson({ error: "Failed to load queued events" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remainingSlots = Math.max(batchSize - (queuedRows?.length ?? 0), 0);
    let retryRows: QueueEvent[] = [];

    if (remainingSlots > 0) {
      const { data, error } = await supabase
        .from("message_automation_events")
        .select("*")
        .eq("status", "retry_pending")
        .lte("next_retry_at", nowIso)
        .order("next_retry_at", { ascending: true })
        .limit(remainingSlots);

      if (error) {
        console.error("dispatch-job-message-automation: failed to load retry rows", error);
        return new Response(asJson({ error: "Failed to load retry events" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      retryRows = (data ?? []) as QueueEvent[];
    }

    const events = [
      ...((queuedRows ?? []) as QueueEvent[]),
      ...retryRows,
    ];

    let sent = 0;
    let failed = 0;
    let scheduledForRetry = 0;
    let skipped = 0;

    for (const event of events) {
      const attemptNumber = Number(event.attempt_count ?? 0) + 1;

      const { data: claimed, error: claimError } = await supabase
        .from("message_automation_events")
        .update({
          status: "processing",
          attempt_count: attemptNumber,
          updated_at: nowIso,
        })
        .eq("id", event.id)
        .in("status", ["queued", "retry_pending"])
        .select("id")
        .maybeSingle();

      if (claimError) {
        console.error("dispatch-job-message-automation: claim failed", { eventId: event.id, error: claimError });
        skipped += 1;
        continue;
      }

      if (!claimed) {
        skipped += 1;
        continue;
      }

      const outboundPayload = {
        ...(event.payload || {}),
        message: event.message_rendered || (event.payload as Record<string, unknown>)?.message || "",
        delivery: {
          event_id: event.id,
          attempt: attemptNumber,
          trigger_source: event.trigger_source,
          queued_status: event.status,
          dispatched_at: nowIso,
        },
      };

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (event.auth_header_name && event.auth_header_value) {
        headers[event.auth_header_name] = event.auth_header_value;
      }

      try {
        const response = await fetch(event.endpoint_url, {
          method: "POST",
          headers,
          body: asJson(outboundPayload),
        });

        const rawBody = await response.text();
        const bodySnippet = responseBodySnippet(rawBody);

        await supabase.from("message_automation_delivery_log").insert({
          event_id: event.id,
          account_id: event.account_id,
          lead_id: event.lead_id,
          attempt_number: attemptNumber,
          endpoint_url: event.endpoint_url,
          status_code: response.status,
          response_body: bodySnippet,
          error_message: response.ok ? null : `HTTP ${response.status}`,
        });

        if (response.ok) {
          sent += 1;
          await supabase
            .from("message_automation_events")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              last_error: null,
              last_response_status: response.status,
              last_response_body: bodySnippet,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", event.id);
          continue;
        }

        const maxAttempts = Number(event.max_attempts ?? 3);
        const backoffMinutes = Number(event.backoff_minutes ?? 5);
        const shouldRetry = attemptNumber < maxAttempts;

        if (shouldRetry) {
          scheduledForRetry += 1;
          const nextRetryAt = new Date(Date.now() + Math.max(backoffMinutes, 0) * 60_000).toISOString();
          await supabase
            .from("message_automation_events")
            .update({
              status: "retry_pending",
              next_retry_at: nextRetryAt,
              last_error: `HTTP ${response.status}`,
              last_response_status: response.status,
              last_response_body: bodySnippet,
              updated_at: new Date().toISOString(),
            })
            .eq("id", event.id);
        } else {
          failed += 1;
          await supabase
            .from("message_automation_events")
            .update({
              status: "failed",
              next_retry_at: null,
              last_error: `HTTP ${response.status}`,
              last_response_status: response.status,
              last_response_body: bodySnippet,
              updated_at: new Date().toISOString(),
            })
            .eq("id", event.id);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown fetch error";

        await supabase.from("message_automation_delivery_log").insert({
          event_id: event.id,
          account_id: event.account_id,
          lead_id: event.lead_id,
          attempt_number: attemptNumber,
          endpoint_url: event.endpoint_url,
          status_code: null,
          response_body: null,
          error_message: errorMessage,
        });

        const maxAttempts = Number(event.max_attempts ?? 3);
        const backoffMinutes = Number(event.backoff_minutes ?? 5);
        const shouldRetry = attemptNumber < maxAttempts;

        if (shouldRetry) {
          scheduledForRetry += 1;
          const nextRetryAt = new Date(Date.now() + Math.max(backoffMinutes, 0) * 60_000).toISOString();
          await supabase
            .from("message_automation_events")
            .update({
              status: "retry_pending",
              next_retry_at: nextRetryAt,
              last_error: errorMessage,
              last_response_status: null,
              last_response_body: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", event.id);
        } else {
          failed += 1;
          await supabase
            .from("message_automation_events")
            .update({
              status: "failed",
              next_retry_at: null,
              last_error: errorMessage,
              last_response_status: null,
              last_response_body: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", event.id);
        }
      }
    }

    return new Response(
      asJson({
        success: true,
        scanned: events.length,
        sent,
        failed,
        scheduled_for_retry: scheduledForRetry,
        skipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("dispatch-job-message-automation: unexpected error", error);
    return new Response(
      asJson({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
