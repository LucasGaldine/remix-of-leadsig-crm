import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type VoiceEntityType = "lead" | "job" | "estimate";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const REQUIRED_FIELD_LABELS: Record<VoiceEntityType, Record<string, string>> = {
  lead: {
    customerName: "Customer name",
  },
  job: {
    customerName: "Customer name",
  },
  estimate: {
    jobName: "Job name",
    lineItemName: "At least one line item",
  },
};

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

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
    return Number.isFinite(parsed) ? parsed : undefined;
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

function normalizeLead(raw: unknown) {
  const parsed = toObject(raw);

  return {
    customerName: cleanString(parsed.customerName),
    customerPhone: cleanString(parsed.customerPhone),
    customerEmail: cleanString(parsed.customerEmail),
    customerAddress: cleanString(parsed.customerAddress),
    customerCity: cleanString(parsed.customerCity),
    serviceType: cleanString(parsed.serviceType),
    estimatedBudget: cleanNumber(parsed.estimatedBudget),
    source: cleanString(parsed.source),
    notes: cleanString(parsed.notes),
  };
}

function normalizeJob(raw: unknown) {
  const parsed = toObject(raw);

  return {
    customerName: cleanString(parsed.customerName),
    customerPhone: cleanString(parsed.customerPhone),
    customerEmail: cleanString(parsed.customerEmail),
    customerAddress: cleanString(parsed.customerAddress),
    jobName: cleanString(parsed.jobName),
    serviceType: cleanString(parsed.serviceType),
    jobAddress: cleanString(parsed.jobAddress),
    description: cleanString(parsed.description),
  };
}

function normalizeEstimate(raw: unknown) {
  const parsed = toObject(raw);
  const lineItemsRaw = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];

  return {
    jobName: cleanString(parsed.jobName),
    notes: cleanString(parsed.notes),
    expiresAt: cleanDate(parsed.expiresAt),
    taxRate: cleanNumber(parsed.taxRate),
    discount: cleanNumber(parsed.discount),
    lineItems: lineItemsRaw
      .map((lineItemRaw) => {
        const lineItem = toObject(lineItemRaw);
        return {
          name: cleanString(lineItem.name),
          description: cleanString(lineItem.description),
          quantity: cleanNumber(lineItem.quantity),
          unit: cleanString(lineItem.unit),
          unitPrice: cleanNumber(lineItem.unitPrice),
        };
      })
      .filter((lineItem) => lineItem.name || lineItem.description || lineItem.unitPrice || lineItem.quantity),
  };
}

function collectMissingFields(entityType: VoiceEntityType, normalized: Record<string, unknown>): string[] {
  const missing = new Set<string>();

  if (entityType === "lead" || entityType === "job") {
    if (!cleanString(normalized.customerName)) {
      missing.add("customerName");
    }
  }

  if (entityType === "estimate") {
    if (!cleanString(normalized.jobName)) {
      missing.add("jobName");
    }

    const lineItems = Array.isArray(normalized.lineItems) ? normalized.lineItems : [];
    const hasLineItemName = lineItems.some((item) => cleanString(toObject(item).name));
    if (!hasLineItemName) {
      missing.add("lineItemName");
    }
  }

  return Array.from(missing);
}

function buildFollowUpQuestions(entityType: VoiceEntityType, missingFields: string[], providedQuestions: unknown) {
  const provided = Array.isArray(providedQuestions) ? providedQuestions : [];

  const providedByField = new Map<string, { field: string; label: string; question: string }>();
  for (const questionRaw of provided) {
    const question = toObject(questionRaw);
    const field = cleanString(question.field);
    if (!field) {
      continue;
    }

    providedByField.set(field, {
      field,
      label: cleanString(question.label) || REQUIRED_FIELD_LABELS[entityType][field] || field,
      question: cleanString(question.question) || `Please provide ${REQUIRED_FIELD_LABELS[entityType][field] || field}.`,
    });
  }

  return missingFields.map((field) => {
    const providedQuestion = providedByField.get(field);
    if (providedQuestion) {
      return providedQuestion;
    }

    return {
      field,
      label: REQUIRED_FIELD_LABELS[entityType][field] || field,
      question: `Please provide ${REQUIRED_FIELD_LABELS[entityType][field] || field}.`,
    };
  });
}

function buildSystemPrompt(entityType: VoiceEntityType) {
  if (entityType === "lead") {
    return `You convert spoken intake into a LeadSig lead payload.
Return JSON only with keys: parsed, followUpQuestions.

parsed object keys:
- customerName (string)
- customerPhone (string)
- customerEmail (string)
- customerAddress (string)
- customerCity (string)
- serviceType (string)
- estimatedBudget (number)
- source (string)
- notes (string)

If a value is not present, use null.
followUpQuestions is an array of { field, label, question } for required details not found.
Required field: customerName.`;
  }

  if (entityType === "job") {
    return `You convert spoken intake into a LeadSig job payload.
Return JSON only with keys: parsed, followUpQuestions.

parsed object keys:
- customerName (string)
- customerPhone (string)
- customerEmail (string)
- customerAddress (string)
- jobName (string)
- serviceType (string)
- jobAddress (string)
- description (string)

If a value is not present, use null.
followUpQuestions is an array of { field, label, question } for required details not found.
Required field: customerName.`;
  }

  return `You convert spoken intake into a LeadSig estimate payload.
Return JSON only with keys: parsed, followUpQuestions.

parsed object keys:
- jobName (string)
- notes (string)
- expiresAt (string, YYYY-MM-DD when possible)
- taxRate (number, percent)
- discount (number)
- lineItems (array of objects)

Each lineItem object keys:
- name (string)
- description (string)
- quantity (number)
- unit (string)
- unitPrice (number)

If a value is not present, use null.
followUpQuestions is an array of { field, label, question } for required details not found.
Required fields: jobName and at least one line item name (field: lineItemName).`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = toObject(await req.json());
    const entityType = cleanString(body.entityType) as VoiceEntityType | undefined;
    const transcript = cleanString(body.transcript);
    const followUpAnswers = toObject(body.followUpAnswers);

    if (!entityType || !["lead", "job", "estimate"].includes(entityType)) {
      return new Response(
        JSON.stringify({ error: "entityType must be one of: lead, job, estimate" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "transcript is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const systemPrompt = buildSystemPrompt(entityType);
    const userPrompt = [
      `Transcript:\n${transcript}`,
      `Follow-up answers JSON:\n${JSON.stringify(followUpAnswers)}`,
      "Use follow-up answers to fill missing required fields whenever possible.",
    ].join("\n\n");

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error("voice-intake-parser: OpenAI request failed", errorText);
      return new Response(
        JSON.stringify({
          error: "OpenAI request failed",
          status: openAiResponse.status,
          details: errorText.slice(0, 500),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const openAiJson = await openAiResponse.json();
    const modelContent = cleanString(openAiJson?.choices?.[0]?.message?.content) || "{}";

    let parsedModelContent: Record<string, unknown>;
    try {
      parsedModelContent = JSON.parse(modelContent) as Record<string, unknown>;
    } catch (error) {
      console.error("voice-intake-parser: invalid JSON returned", error);
      parsedModelContent = {};
    }

    const modelParsed = parsedModelContent.parsed;
    const normalized = entityType === "lead"
      ? normalizeLead(modelParsed)
      : entityType === "job"
      ? normalizeJob(modelParsed)
      : normalizeEstimate(modelParsed);

    const missingFields = collectMissingFields(entityType, normalized as unknown as Record<string, unknown>);
    const followUpQuestions = buildFollowUpQuestions(entityType, missingFields, parsedModelContent.followUpQuestions);

    return new Response(
      JSON.stringify({
        entityType,
        parsed: normalized,
        missingFields,
        followUpQuestions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("voice-intake-parser: unexpected error", error);

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
