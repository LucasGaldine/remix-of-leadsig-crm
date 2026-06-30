import { assertEquals } from "jsr:@std/assert";

import { resolveTemplateBody } from "./signed-documents.ts";

Deno.test("resolveTemplateBody uses configured document template body over legacy generated agreement body", () => {
  const body = resolveTemplateBody(
    {
      system_key: "job_agreement",
      body: "Configured template body",
    },
  );

  assertEquals(body, "Configured template body");
});
