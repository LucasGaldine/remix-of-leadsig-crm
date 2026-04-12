import { describe, expect, it } from "vitest";

import { applyCustomerContactToJob } from "@/lib/jobCustomerCache";

describe("applyCustomerContactToJob", () => {
  it("overwrites customer contact fields with the latest Job Edit values", () => {
    const currentJob = {
      id: "job_1",
      name: "Front Yard Cleanup",
      customer: {
        id: "cust_1",
        name: "Taylor Smith",
        phone: "5551234567",
        email: null,
        address: null,
        city: null,
      },
    };

    const updated = applyCustomerContactToJob(currentJob, {
      customer_name: "Taylor Smith",
      customer_phone: "5551234567",
      customer_email: "theplatinumplug@gmail.com",
      customer_address: "1 Main St",
      customer_city: "Miami",
    });

    expect(updated.customer.email).toBe("theplatinumplug@gmail.com");
  });
});
