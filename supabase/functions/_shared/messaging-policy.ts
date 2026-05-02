import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type MessagingChannel = "sms" | "email";
export type MessagingDecision = "allow" | "deny" | "cooldown";

export interface MessagingPolicyInput {
  accountId: string;
  to: string;
  body: string;
  channel: MessagingChannel;
  templateId?: string | null;
  consentStatus?: string | null;
  consentSource?: string | null;
}

export interface MessagingPolicyResult {
  allow: boolean;
  decision: MessagingDecision;
  reason: string;
  riskScore: number;
  cooldownUntil: string | null;
  policyVersion: string;
}

const POLICY_VERSION = "sms_policy_v1";
const PUBLIC_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "buff.ly", "shorturl.at", "rebrand.ly",
]);
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "unsub", "remove"]);
const PROMO_KEYWORDS = [/\bfree\b/i, /\bwin\b/i, /\bprize\b/i, /\bguarantee\b/i, /\bclick now\b/i, /\blimited time\b/i, /\bcrypto\b/i];

function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function getAllowedDomains(): Set<string> {
  const raw = Deno.env.get("ALLOWED_SMS_LINK_DOMAINS") || "";
  return new Set(raw.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
}

function extractLinkHosts(message: string): string[] {
  const matches = message.match(/https?:\/\/[^\s]+/gi) || [];
  const hosts: string[] = [];
  for (const link of matches) {
    try {
      hosts.push(new URL(link).hostname.toLowerCase());
    } catch {
      // Ignore malformed URLs.
    }
  }
  return hosts;
}

function hasUnicodeObfuscation(message: string): boolean {
  if (!message) return false;
  const nonAsciiCount = Array.from(message).filter((ch) => ch.charCodeAt(0) > 127).length;
  const ratio = nonAsciiCount / Math.max(1, message.length);
  return ratio >= 0.15;
}

function computeContentRisk(params: { channel: MessagingChannel; body: string }): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const body = params.body.trim();
  const hosts = extractLinkHosts(body);
  const allowedDomains = getAllowedDomains();

  if (hosts.length > 2 && params.channel === "sms") {
    score += 45;
    reasons.push("too_many_links");
  }

  for (const host of hosts) {
    if (PUBLIC_SHORTENERS.has(host)) {
      score += 75;
      reasons.push("public_url_shortener");
    }

    if (allowedDomains.size > 0 && !allowedDomains.has(host) && params.channel === "sms") {
      score += 25;
      reasons.push("domain_not_allowlisted");
    }
  }

  for (const pattern of PROMO_KEYWORDS) {
    if (pattern.test(body)) {
      score += 20;
      reasons.push("promotional_keyword");
      break;
    }
  }

  if (hasUnicodeObfuscation(body)) {
    score += 25;
    reasons.push("unicode_obfuscation");
  }

  return { score, reasons };
}

async function upsertReputation(supabase: SupabaseClient, accountId: string) {
  await supabase.from("account_messaging_reputation").upsert({ account_id: accountId }, { onConflict: "account_id" });
}

export async function evaluateMessagingPolicy(
  supabase: SupabaseClient,
  input: MessagingPolicyInput,
): Promise<MessagingPolicyResult> {
  const normalizedRecipient = input.channel === "sms" ? normalizePhone(input.to) : input.to.trim().toLowerCase();
  const reasonParts: string[] = [];
  let riskScore = 0;
  let decision: MessagingDecision = "allow";
  let cooldownUntil: string | null = null;

  await upsertReputation(supabase, input.accountId);

  if ((Deno.env.get("SMS_SHARED_NUMBER_KILL_SWITCH") || "false").toLowerCase() === "true" && input.channel === "sms") {
    riskScore = 100;
    decision = "deny";
    reasonParts.push("shared_number_kill_switch_enabled");
  }

  const { data: reputation } = await supabase
    .from("account_messaging_reputation")
    .select("sms_state, sms_risk_score, blocked_attempts, failed_delivery_count, opt_out_count, unknown_recipient_count")
    .eq("account_id", input.accountId)
    .maybeSingle();

  if (input.channel === "sms") {
    if (reputation?.sms_state === "suspended") {
      riskScore = Math.max(riskScore, 100);
      decision = "deny";
      reasonParts.push("account_suspended");
    } else if (reputation?.sms_state === "limited") {
      riskScore += 20;
      reasonParts.push("account_limited");
    }
  }

  const { data: suppression } = await supabase
    .from("message_suppression_list")
    .select("id")
    .eq("channel", input.channel)
    .eq("address", normalizedRecipient)
    .eq("active", true)
    .or(`account_id.eq.${input.accountId},account_id.is.null`)
    .limit(1)
    .maybeSingle();

  if (suppression) {
    riskScore = Math.max(riskScore, 100);
    decision = "deny";
    reasonParts.push("suppressed_recipient");
  }

  if (input.channel === "sms") {
    const consent = (input.consentStatus || "unknown").trim().toLowerCase();
    if (consent !== "opted_in") {
      riskScore += 65;
      reasonParts.push("missing_or_invalid_consent");
    }
    if (!input.consentSource?.trim()) {
      riskScore += 15;
      reasonParts.push("missing_consent_source");
    }
  }

  const now = Date.now();
  const minuteAgo = new Date(now - 60_000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60_000).toISOString();

  const [{ count: minuteCount }, { count: dayCount }, { data: uniqueRecipients }, { count: templateCount }] = await Promise.all([
    supabase
      .from("messaging_risk_events")
      .select("id", { count: "exact", head: true })
      .eq("account_id", input.accountId)
      .eq("channel", input.channel)
      .eq("decision", "allow")
      .gte("created_at", minuteAgo),
    supabase
      .from("messaging_risk_events")
      .select("id", { count: "exact", head: true })
      .eq("account_id", input.accountId)
      .eq("channel", input.channel)
      .eq("decision", "allow")
      .gte("created_at", dayAgo),
    supabase
      .from("messaging_risk_events")
      .select("recipient")
      .eq("account_id", input.accountId)
      .eq("channel", input.channel)
      .eq("decision", "allow")
      .gte("created_at", dayAgo)
      .limit(500),
    supabase
      .from("messaging_risk_events")
      .select("id", { count: "exact", head: true })
      .eq("account_id", input.accountId)
      .eq("channel", input.channel)
      .eq("template_id", input.templateId || "")
      .eq("decision", "allow")
      .gte("created_at", dayAgo),
  ]);

  const uniqueRecipientCount = new Set((uniqueRecipients || []).map((r) => String(r.recipient || "")).filter(Boolean)).size;

  if ((minuteCount || 0) >= 6) {
    riskScore += 40;
    reasonParts.push("burst_limit_exceeded");
  }
  if ((dayCount || 0) >= 150) {
    riskScore += 35;
    reasonParts.push("daily_cap_exceeded");
  }
  if (uniqueRecipientCount >= 80 && input.channel === "sms") {
    riskScore += 30;
    reasonParts.push("recipient_diversity_spike");
  }
  if (input.templateId && (templateCount || 0) >= 40) {
    riskScore += 20;
    reasonParts.push("template_repetition_spike");
  }

  if ((reputation?.failed_delivery_count || 0) >= 12) {
    riskScore += 20;
    reasonParts.push("failed_delivery_spike");
  }
  if ((reputation?.opt_out_count || 0) >= 6) {
    riskScore += 35;
    reasonParts.push("opt_out_spike");
  }
  if ((reputation?.blocked_attempts || 0) >= 8) {
    riskScore += 20;
    reasonParts.push("blocked_attempts_spike");
  }

  const contentRisk = computeContentRisk({ channel: input.channel, body: input.body });
  riskScore += contentRisk.score;
  reasonParts.push(...contentRisk.reasons);

  if (decision !== "deny") {
    if (riskScore >= 85) {
      decision = "deny";
    } else if (riskScore >= 55) {
      decision = "cooldown";
      cooldownUntil = new Date(now + 5 * 60_000).toISOString();
    }
  }

  const reason = reasonParts.length > 0 ? [...new Set(reasonParts)].join(",") : "policy_allow";

  await supabase.from("messaging_risk_events").insert({
    account_id: input.accountId,
    channel: input.channel,
    recipient: normalizedRecipient || null,
    template_id: input.templateId || null,
    message_excerpt: input.body.slice(0, 280),
    risk_score: riskScore,
    decision,
    reason,
    policy_version: POLICY_VERSION,
    cooldown_until: cooldownUntil,
    metadata: {
      minute_count: minuteCount || 0,
      day_count: dayCount || 0,
      unique_recipient_count: uniqueRecipientCount,
      consent_status: input.consentStatus || null,
    },
  });

  if (decision !== "allow") {
    const blockedAttempts = (reputation?.blocked_attempts || 0) + 1;
    const nextState = blockedAttempts >= 15 ? "suspended" : blockedAttempts >= 8 ? "limited" : (reputation?.sms_state || "active");
    await supabase
      .from("account_messaging_reputation")
      .update({
        blocked_attempts: blockedAttempts,
        sms_state: nextState,
        sms_risk_score: Math.max(riskScore, reputation?.sms_risk_score || 0),
        last_state_change_at: nextState !== reputation?.sms_state ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", input.accountId);
  }

  return {
    allow: decision === "allow",
    decision,
    reason,
    riskScore,
    cooldownUntil,
    policyVersion: POLICY_VERSION,
  };
}

export async function recordMessagingOutcome(
  supabase: SupabaseClient,
  params: {
    accountId: string;
    channel: MessagingChannel;
    recipient: string;
    success: boolean;
    carrierErrorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  await upsertReputation(supabase, params.accountId);

  if (params.channel !== "sms") return;

  const { data: reputation } = await supabase
    .from("account_messaging_reputation")
    .select("failed_delivery_count, sms_state")
    .eq("account_id", params.accountId)
    .maybeSingle();

  const failedCount = (reputation?.failed_delivery_count || 0) + (params.success ? 0 : 1);
  const nextState = failedCount >= 20 ? "suspended" : failedCount >= 10 ? "limited" : (reputation?.sms_state || "active");

  await supabase
    .from("account_messaging_reputation")
    .update({
      failed_delivery_count: failedCount,
      sms_state: nextState,
      last_state_change_at: nextState !== reputation?.sms_state ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      metadata: {
        last_error_code: params.carrierErrorCode || null,
        last_error_message: params.errorMessage || null,
      },
    })
    .eq("account_id", params.accountId);
}

export function isStopLikeMessage(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

export function normalizeSmsAddress(value: string): string {
  return normalizePhone(value);
}
