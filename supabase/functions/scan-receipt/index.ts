import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a receipt scanner. Extract all line items from this receipt image and return them as a JSON array.

For each item return:
- name: the item name (string)
- description: any additional detail or brand info (string or null)
- quantity: numeric quantity purchased (number, default 1)
- unit: unit of measure such as "each", "lb", "ft", "bag", "box", etc. (string, default "each")
- unit_price: price per unit in dollars (number)
- total: quantity * unit_price (number)

Return ONLY valid JSON array, no markdown, no explanation. Example:
[{"name":"PVC Pipe 1in","description":"10ft length","quantity":5,"unit":"each","unit_price":4.99,"total":24.95}]

If you cannot read the receipt or no items are found, return an empty array: []`,
              },
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error("OpenAI error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process receipt with AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content ?? "[]";

    let items: unknown[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      items = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse OpenAI response:", content);
      items = [];
    }

    const lineItems = (Array.isArray(items) ? items : []).map((item: any) => ({
      name: String(item.name ?? "Unknown Item"),
      description: item.description ? String(item.description) : null,
      quantity: Number(item.quantity) || 1,
      unit: String(item.unit ?? "each"),
      unit_price: Number(item.unit_price) || 0,
      total: Number(item.total) || (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
      category: "materials",
    }));

    return new Response(
      JSON.stringify({ lineItems }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
