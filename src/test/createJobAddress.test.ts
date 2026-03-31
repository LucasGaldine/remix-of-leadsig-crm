import { describe, expect, it } from "vitest";

import { resolveCreateJobAddress } from "@/lib/createJobAddress";

describe("resolveCreateJobAddress", () => {
  it("prefers the explicit job address when one is entered", () => {
    expect(
      resolveCreateJobAddress({
        jobAddress: "456 Project Ln",
        customerAddress: "123 Client St",
      }),
    ).toBe("456 Project Ln");
  });

  it("falls back to the client address when the job address is blank", () => {
    expect(
      resolveCreateJobAddress({
        jobAddress: "   ",
        customerAddress: "123 Client St",
      }),
    ).toBe("123 Client St");
  });

  it("allows the job to be created without any address", () => {
    expect(
      resolveCreateJobAddress({
        jobAddress: "",
        customerAddress: "",
      }),
    ).toBeNull();
  });
});
