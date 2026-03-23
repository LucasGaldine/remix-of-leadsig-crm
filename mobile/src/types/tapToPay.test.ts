import { describe, expect, it } from "vitest";

import { parseTapToPayLink } from "./tapToPay";

describe("parseTapToPayLink", () => {
  it("extracts session identifiers from deep links", () => {
    expect(
      parseTapToPayLink(
        "leadsig://tap-to-pay?invoiceId=inv_1&paymentIntentId=pi_1&sessionId=sess_1",
      ),
    ).toMatchObject({
      invoiceId: "inv_1",
      paymentIntentId: "pi_1",
      sessionId: "sess_1",
    });
  });

  it("returns null for malformed urls", () => {
    expect(parseTapToPayLink("not a url")).toBeNull();
  });

  it("returns null for unsupported schemes and routes", () => {
    expect(parseTapToPayLink("https://tap-to-pay?invoiceId=inv_1")).toBeNull();
    expect(parseTapToPayLink("leadsig://settings?invoiceId=inv_1")).toBeNull();
  });

  it("parses numeric amounts and ignores invalid values", () => {
    expect(
      parseTapToPayLink("leadsig://tap-to-pay?invoiceId=inv_1&amount=249.5"),
    ).toMatchObject({
      invoiceId: "inv_1",
      amount: 249.5,
    });

    expect(
      parseTapToPayLink("leadsig://tap-to-pay?invoiceId=inv_1&amount=not-a-number"),
    ).toMatchObject({
      invoiceId: "inv_1",
      amount: undefined,
    });
  });
});
