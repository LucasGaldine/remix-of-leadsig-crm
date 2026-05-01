import { describe, expect, it } from "vitest";
import { extractQualificationDecisionFromRetellResponse } from "../../supabase/functions/_shared/lead-automation-context";

describe("extractQualificationDecisionFromRetellResponse", () => {
  it("returns qualified decision from post-chat data extraction", () => {
    const result = extractQualificationDecisionFromRetellResponse({
      post_chat_data: { qualified: false, reason: "Outside service area" },
      messages: [{ role: "assistant", content: "{\"qualified\":true}" }],
    });

    expect(result.qualified).toBe(false);
    expect(result.reason).toBe("Outside service area");
  });

  it("returns status decision from post-chat extraction payload", () => {
    const result = extractQualificationDecisionFromRetellResponse({
      extracted_data: { status: "not_qualified", reason: "Below minimum" },
    });

    expect(result.qualified).toBe(false);
    expect(result.reason).toBe("Below minimum");
  });

  it("returns qualified true from JSON content", () => {
    const result = extractQualificationDecisionFromRetellResponse({
      messages: [{ role: "assistant", content: "{\"qualified\":true,\"reason\":\"In service area\"}" }],
    });

    expect(result.qualified).toBe(true);
    expect(result.reason).toBe("In service area");
  });

  it("returns qualified false from status content", () => {
    const result = extractQualificationDecisionFromRetellResponse({
      messages: [{ role: "assistant", content: "{\"status\":\"not_qualified\",\"reason\":\"Below minimum\"}" }],
    });

    expect(result.qualified).toBe(false);
    expect(result.reason).toBe("Below minimum");
  });

  it("returns null when no decision is present", () => {
    const result = extractQualificationDecisionFromRetellResponse({
      messages: [{ role: "assistant", content: "Thanks for the details. We will follow up." }],
    });

    expect(result.qualified).toBeNull();
  });
});
