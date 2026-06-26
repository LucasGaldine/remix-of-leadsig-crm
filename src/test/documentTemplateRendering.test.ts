import { describe, expect, it } from "vitest";

import {
  renderDocumentTemplate,
  resolveDocumentTemplateVariableFallbackValue,
} from "../../supabase/functions/_shared/document-template-rendering";

describe("shared document template rendering", () => {
  it("renders both token styles, formats phone values, and applies built-in fallbacks", () => {
    expect(
      renderDocumentTemplate(
        "Hi [[client_name]], call {{ client_phone }}. Missing: [[company_name]]. Custom: [[unknown_value]].",
        {
          client_name: "Taylor",
          client_phone: "5551234567",
        },
      ),
    ).toBe("Hi Taylor, call (555) 123-4567. Missing: Not provided. Custom: .");
  });

  it("uses the current date fallback for current_date", () => {
    expect(resolveDocumentTemplateVariableFallbackValue("current_date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
