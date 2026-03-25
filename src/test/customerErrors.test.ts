import { describe, expect, it } from "vitest";

import { getCustomerWriteErrorMessage } from "@/lib/customerErrors";

describe("getCustomerWriteErrorMessage", () => {
  it("returns a friendly message for duplicate name + address violations", () => {
    const message = getCustomerWriteErrorMessage({
      code: "23505",
      constraint: "customers_account_name_address_unique",
      message: "duplicate key value violates unique constraint",
    });

    expect(message).toBe("A customer with this name and address already exists.");
  });

  it("falls back to generic message for unknown errors", () => {
    const message = getCustomerWriteErrorMessage(new Error("boom"));

    expect(message).toBe("Failed to create customer");
  });
});
