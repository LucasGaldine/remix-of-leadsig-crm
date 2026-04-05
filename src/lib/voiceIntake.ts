import { supabase } from "@/integrations/supabase/client";
import type {
  VoiceEntityType,
  VoiceEstimateLineItemParsedData,
  VoiceEstimateParsedData,
  VoiceIntakeParserResponse,
  VoiceJobParsedData,
  VoiceLeadParsedData,
} from "@/types/voiceIntake";

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cleanNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[$,%\s,]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function cleanDate(value: unknown): string | undefined {
  const text = cleanString(value);
  if (!text) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString().split("T")[0];
}

export function normalizeVoiceLeadParsedData(raw: unknown): VoiceLeadParsedData {
  const source = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};

  return {
    customerName: cleanString(source.customerName),
    customerPhone: cleanString(source.customerPhone),
    customerEmail: cleanString(source.customerEmail),
    customerAddress: cleanString(source.customerAddress),
    customerCity: cleanString(source.customerCity),
    serviceType: cleanString(source.serviceType),
    estimatedBudget: cleanNumber(source.estimatedBudget),
    source: cleanString(source.source),
    notes: cleanString(source.notes),
  };
}

export function normalizeVoiceJobParsedData(raw: unknown): VoiceJobParsedData {
  const source = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};

  return {
    customerName: cleanString(source.customerName),
    customerPhone: cleanString(source.customerPhone),
    customerEmail: cleanString(source.customerEmail),
    customerAddress: cleanString(source.customerAddress),
    jobName: cleanString(source.jobName),
    serviceType: cleanString(source.serviceType),
    jobAddress: cleanString(source.jobAddress),
    description: cleanString(source.description),
  };
}

export function normalizeVoiceEstimateLineItem(raw: unknown): VoiceEstimateLineItemParsedData {
  const source = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};

  return {
    name: cleanString(source.name),
    description: cleanString(source.description),
    quantity: cleanNumber(source.quantity),
    unit: cleanString(source.unit),
    unitPrice: cleanNumber(source.unitPrice),
  };
}

export function normalizeVoiceEstimateParsedData(raw: unknown): VoiceEstimateParsedData {
  const source = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};

  return {
    jobName: cleanString(source.jobName),
    notes: cleanString(source.notes),
    expiresAt: cleanDate(source.expiresAt),
    taxRate: cleanNumber(source.taxRate),
    discount: cleanNumber(source.discount),
    lineItems: Array.isArray(source.lineItems)
      ? source.lineItems.map(normalizeVoiceEstimateLineItem)
      : [],
  };
}

export function matchServiceType(serviceType: string | undefined, availableServiceTypes: string[]): string {
  if (!serviceType) {
    return "";
  }

  const exactMatch = availableServiceTypes.find((type) => type.toLowerCase() === serviceType.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const fuzzyMatch = availableServiceTypes.find((type) => {
    const normalizedType = type.toLowerCase();
    const normalizedTarget = serviceType.toLowerCase();
    const singularType = normalizedType.endsWith("s") ? normalizedType.slice(0, -1) : normalizedType;
    const singularTarget = normalizedTarget.endsWith("s") ? normalizedTarget.slice(0, -1) : normalizedTarget;
    return normalizedType.includes(normalizedTarget)
      || normalizedTarget.includes(normalizedType)
      || singularType.includes(singularTarget)
      || singularTarget.includes(singularType);
  });

  return fuzzyMatch || "";
}

export async function callVoiceIntakeParser(
  entityType: VoiceEntityType,
  transcript: string,
  followUpAnswers?: Record<string, string>,
): Promise<VoiceIntakeParserResponse> {
  const { data, error } = await supabase.functions.invoke("voice-intake-parser", {
    body: {
      entityType,
      transcript,
      followUpAnswers,
    },
  });

  if (error) {
    let message = error.message || "Unable to process voice intake";

    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const contextJson = await context.clone().json() as {
          error?: string;
          details?: string;
          status?: number;
        };

        const contextualMessage = [contextJson.error, contextJson.details]
          .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
          .join(": ");

        if (contextualMessage) {
          message = contextualMessage;
        }
      } catch {
        // Ignore context parsing errors and fall back to the base error message.
      }
    }

    throw new Error(message);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Voice intake parser returned an invalid response");
  }

  return {
    entityType,
    parsed: (data as Record<string, unknown>).parsed as VoiceIntakeParserResponse["parsed"],
    missingFields: Array.isArray((data as Record<string, unknown>).missingFields)
      ? ((data as Record<string, unknown>).missingFields as string[])
      : [],
    followUpQuestions: Array.isArray((data as Record<string, unknown>).followUpQuestions)
      ? ((data as Record<string, unknown>).followUpQuestions as VoiceIntakeParserResponse["followUpQuestions"])
      : [],
  };
}
