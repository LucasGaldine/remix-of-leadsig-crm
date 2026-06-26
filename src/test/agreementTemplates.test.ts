import { describe, expect, it } from "vitest";

import { generateAgreementTemplates } from "@/lib/agreementTemplates";

describe("generateAgreementTemplates", () => {
  it("omits legacy signatures placeholders across all agreement templates", () => {
    const templates = generateAgreementTemplates({
      todayIso: "2026-05-02",
      contractorName: "LG Contracting",
      contractorAddress: "123 Main St",
      contractorPhone: "555-111-2222",
      contractorEmail: "team@lg.example",
      clientName: "Lucas Galdine",
      projectName: "Outdoor Remodel",
      projectAddress: "456 Oak Ave",
      scopeItems: ["Install pavers"],
      totalCost: 10000,
      paymentMethod: "Stripe",
    });

    for (const value of Object.values(templates)) {
      expect(value).not.toMatch(/\bSIGNATURES\b/i);
      expect(value).not.toMatch(/Client Signature:/i);
      expect(value).not.toMatch(/Contractor Signature:/i);
      expect(value).not.toMatch(/Printed Name:/i);
      expect(value).not.toMatch(/^Date:\s*_{2,}/im);
    }
  });

  it("keeps generated job agreement terms in paragraphs outside the scope list", () => {
    const templates = generateAgreementTemplates({
      todayIso: "2026-05-02",
      contractorName: "LG Contracting",
      contractorAddress: "123 Main St",
      contractorPhone: "555-111-2222",
      contractorEmail: "team@lg.example",
      clientName: "Lucas Galdine",
      projectName: "Outdoor Remodel",
      projectAddress: "456 Oak Ave",
      scopeItems: ["Install pavers", "Seal joints"],
      totalCost: 10000,
      paymentMethod: "Stripe",
    });

    expect(templates.job_agreement).toContain("1. Install pavers");
    expect(templates.job_agreement).toContain("2. Seal joints");
    expect(templates.job_agreement).not.toMatch(/^Change Orders may affect cost and timeline$/m);
    expect(templates.job_agreement).not.toMatch(/^General Liability Insurance$/m);
    expect(templates.job_agreement).not.toMatch(/^Provide full access to the work site$/m);
    expect(templates.job_agreement).not.toMatch(/^Method: Binding arbitration$/m);
    expect(templates.job_agreement).not.toMatch(/^The Client shall pay for all completed work and materials purchased$/m);
  });
});
