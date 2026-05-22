import { describe, expect, it } from "vitest";

import {
  buildScopeOfWorkValue,
  documentTemplateMarkdownToPlainText,
  DEFAULT_DOCUMENT_TEMPLATE_DEFINITIONS,
  DOCUMENT_TEMPLATE_VARIABLES,
  DOCUMENT_EMAIL_TIMINGS,
  formatDocumentTemplateToken,
  getDocumentFallbackText,
  normalizeDocumentTemplateSlug,
  renderDocumentTemplateMarkdownHtml,
  renderDocumentTemplateText,
} from "@/lib/documentTemplates";

describe("documentTemplates", () => {
  it("defines the supported email timing options", () => {
    expect(DOCUMENT_EMAIL_TIMINGS).toEqual([
      "never",
      "on_estimate_approval",
      "on_job_completion",
      "manual",
    ]);
  });

  it("normalizes template names into stable slugs", () => {
    expect(normalizeDocumentTemplateSlug("   Final  Walkthrough / Checklist ")).toBe("final-walkthrough-checklist");
    expect(normalizeDocumentTemplateSlug("***")).toBe("document");
  });

  it("resolves fallback text for system and custom templates", () => {
    const jobAgreementTemplate = DEFAULT_DOCUMENT_TEMPLATE_DEFINITIONS.find(
      (template) => template.system_key === "job_agreement",
    );

    const customTemplate = {
      name: "Custom",
      body: "Custom template body",
      system_key: null,
    };

    expect(
      getDocumentFallbackText({
        template: {
          ...jobAgreementTemplate!,
          body: "",
        },
        estimateAgreementTemplates: {
          job_agreement: "Generated job agreement text",
        },
        jobReleaseText: null,
      }),
    ).toBe("Generated job agreement text");

    expect(
      getDocumentFallbackText({
        template: customTemplate,
        estimateAgreementTemplates: null,
        jobReleaseText: null,
        templateMergeFields: {
          client_name: "Taylor Client",
        },
      }),
    ).toBe("Custom template body");
  });

  it("renders supported [[field]] merge tokens", () => {
    expect(
      renderDocumentTemplateText(
        "Hi [[client_name]], your project is [[job_name]].",
        { client_name: "Taylor", job_name: "Kitchen Remodel" },
      ),
    ).toBe("Hi Taylor, your project is Kitchen Remodel.");
  });

  it("renders supported {{field}} merge tokens", () => {
    expect(
      renderDocumentTemplateText(
        "Hi {{client_name}}, your project is {{job_name}}.",
        { client_name: "Taylor", job_name: "Kitchen Remodel" },
      ),
    ).toBe("Hi Taylor, your project is Kitchen Remodel.");
  });

  it("formats phone merge fields as phone numbers", () => {
    expect(
      renderDocumentTemplateText(
        "Call us at [[company_phone]] or client at [[client_phone]].",
        { company_phone: "5551234567", client_phone: "+15557654321" },
      ),
    ).toBe("Call us at (555) 123-4567 or client at +1 (555) 765-4321.");
  });

  it("builds scope of work text from line items", () => {
    expect(
      buildScopeOfWorkValue({
        lineItems: [
          { name: "Demo", description: "Remove old cabinets", quantity: 1, unit: "ea" },
          { name: "Install", description: "Install new cabinets", quantity: 1, unit: "ea" },
        ],
      }),
    ).toContain("1. Demo (1 ea): Remove old cabinets");
  });

  it("exposes document template variable tokens including scope of work", () => {
    const variableKeys = DOCUMENT_TEMPLATE_VARIABLES.map((variable) => variable.key);
    expect(variableKeys).toContain("scope_of_work");
    expect(variableKeys).toContain("client_phone");
    expect(variableKeys).toContain("default_payment_schedule");
    expect(variableKeys).toContain("default_payment_deposit_percentage");
    expect(variableKeys).toContain("default_payment_midpoint_percentage");
    expect(variableKeys).toContain("default_payment_final_percentage");
    expect(formatDocumentTemplateToken("scope_of_work")).toBe("[[scope_of_work]]");
  });

  it("renders markdown headings and bullets into html", () => {
    const html = renderDocumentTemplateMarkdownHtml("# Title\n\n- **One**\n- Two");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>One</strong>");
  });

  it("converts markdown to plain text for pdf-safe output", () => {
    expect(documentTemplateMarkdownToPlainText("## Header\n\n- **A**\n- B")).toBe("Header\n- A\n- B");
  });
});
