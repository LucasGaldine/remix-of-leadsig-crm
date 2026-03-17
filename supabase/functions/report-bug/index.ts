const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CLICKUP_LIST_ID = "901712017388";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clickupApiKey = Deno.env.get("CLICKUP_API_KEY");
    if (!clickupApiKey) {
      return new Response(
        JSON.stringify({ error: "ClickUp API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { page, expected, actual, additionalDetail, imageBase64, imageFileName } = await req.json();

    if (!page || !expected || !actual) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const description = [
      `**Page:** ${page}`,
      "",
      `**Expected behavior:**\n${expected}`,
      "",
      `**Actual behavior:**\n${actual}`,
      ...(additionalDetail ? ["", `**Additional details:**\n${additionalDetail}`] : []),
    ].join("\n");

    const taskPayload: Record<string, unknown> = {
      name: `Bug: ${page}`,
      description,
      status: "backlog",
      priority: 2,
    };

    const createRes = await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`, {
      method: "POST",
      headers: {
        "Authorization": clickupApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(taskPayload),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error("ClickUp task creation failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create ClickUp task" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const task = await createRes.json();

    if (imageBase64 && imageFileName && task.id) {
      try {
        const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
        const mimeType = imageBase64.includes("data:") ? imageBase64.split(";")[0].split(":")[1] : "image/png";
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });

        const formData = new FormData();
        formData.append("attachment", blob, imageFileName);

        await fetch(`https://api.clickup.com/api/v2/task/${task.id}/attachment`, {
          method: "POST",
          headers: {
            "Authorization": clickupApiKey,
          },
          body: formData,
        });
      } catch (attachErr) {
        console.error("Failed to attach image:", attachErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, taskId: task.id, taskUrl: task.url }),
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
