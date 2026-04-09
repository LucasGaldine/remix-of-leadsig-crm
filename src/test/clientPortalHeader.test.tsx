import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClientPortalHeader } from "@/components/client-portal/ClientPortalHeader";

describe("ClientPortalHeader", () => {
  it("renders the company logo without forced color inversion", () => {
    render(
      <ClientPortalHeader
        job={{
          name: "Patio Build",
          customer: { name: "Alex Doe" },
        }}
        company={{
          company_name: "LeadSig",
          logo_url: "https://example.com/logo.png",
        }}
        estimate={null}
        statusLabel="Scheduled"
        statusColor="bg-blue-500 text-white"
        portalColor="#0f766e"
        portalTextColor="#ffffff"
      />,
    );

    const logo = screen.getByRole("img", { name: "LeadSig" });

    expect(logo).not.toHaveClass("invert");
    expect(logo).not.toHaveClass("brightness-0");
  });
});
