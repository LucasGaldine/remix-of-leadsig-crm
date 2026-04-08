import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientPortalEstimate } from "@/components/client-portal/ClientPortalEstimate";

const { generateEstimatePDF } = vi.hoisted(() => ({
  generateEstimatePDF: vi.fn(),
}));

vi.mock("@/lib/pdfGenerator", () => ({
  generateEstimatePDF,
}));

describe("ClientPortalEstimate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes the company logo through when downloading the estimate PDF", () => {
    render(
      <ClientPortalEstimate
        estimate={{
          total: 1250,
          subtotal: 1250,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          status: "sent",
          updated_at: "2026-03-23T00:00:00.000Z",
          line_items: [
            {
              id: "item_1",
              name: "Mulch",
              quantity: 1,
              unit: "job",
              unit_price: 1250,
              total: 1250,
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
        customerName="Taylor Smith"
        jobName="Garden Refresh"
        address="1 Main St"
        companyName="LeadSig"
        companyEmail="hello@example.com"
        companyPhone="555-1234"
        companyLogoUrl="https://example.com/logo.png"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));

    expect(generateEstimatePDF).toHaveBeenCalledWith(
      expect.objectContaining({
        companyLogoUrl: "https://example.com/logo.png",
      }),
    );
  });

  it("sends selected estimate version id when approving", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClientPortalEstimate
        estimate={{
          total: 1250,
          subtotal: 1250,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          status: "sent",
          updated_at: "2026-03-23T00:00:00.000Z",
          line_items: [
            {
              id: "item_1",
              name: "Mulch",
              quantity: 1,
              unit: "job",
              unit_price: 1250,
              total: 1250,
            },
          ],
          estimate_versions: [
            {
              id: "ver_1",
              name: "Good",
              subtotal: 1000,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1000,
              line_items: [],
            },
            {
              id: "ver_2",
              name: "Better",
              subtotal: 1250,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1250,
              line_items: [],
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Approve$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const requestOptions = fetchMock.mock.calls[0][1] as { body: string };
    expect(JSON.parse(requestOptions.body)).toMatchObject({
      action: "approve",
      estimate_version_id: "ver_2",
    });
  });
});
