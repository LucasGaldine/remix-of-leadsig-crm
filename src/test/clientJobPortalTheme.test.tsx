import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ClientJobPortal from "@/pages/ClientJobPortal";

describe("ClientJobPortal theming", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses portal color and portal text color on the invoice call to action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        job: {
          name: "Spring Cleanup",
          status: "job",
          created_at: "2026-04-01T00:00:00.000Z",
          customer: { name: "Sarah" },
        },
        company: {
          company_name: "LeadSig",
          portal_color: "#1e40af",
          portal_text_color: "#f8fafc",
        },
        schedules: [],
        estimate_visit_schedules: [],
        estimate: null,
        invoice: {
          stripe_invoice_url: "https://example.com/invoice",
          status: "open",
        },
        photos: { before: [], after: [] },
        activity: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123&jobId=job_1"]}>
        <ClientJobPortal />
      </MemoryRouter>,
    );

    const payInvoiceLink = await screen.findByRole("link", { name: /Pay Invoice/i });

    expect(payInvoiceLink).toHaveStyle({
      backgroundColor: "#1e40af",
      color: "#f8fafc",
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("falls back to company profile client portal settings keys for invoice call to action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        job: {
          name: "Spring Cleanup",
          status: "job",
          created_at: "2026-04-01T00:00:00.000Z",
          customer: { name: "Sarah" },
        },
        company: {
          company_name: "LeadSig",
          client_portal_color: "#0f766e",
          client_portal_text_color: "#ecfeff",
        },
        schedules: [],
        estimate_visit_schedules: [],
        estimate: null,
        invoice: {
          stripe_invoice_url: "https://example.com/invoice",
          status: "open",
        },
        photos: { before: [], after: [] },
        activity: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123&jobId=job_1"]}>
        <ClientJobPortal />
      </MemoryRouter>,
    );

    const payInvoiceLink = await screen.findByRole("link", { name: /Pay Invoice/i });

    expect(payInvoiceLink).toHaveStyle({
      backgroundColor: "#0f766e",
      color: "#ecfeff",
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("uses portal color and text color on the customer portal welcome header card", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customer: {
          name: "Another import",
        },
        company: {
          company_name: "LG Contracting",
          portal_color: "#dbeaff",
          portal_text_color: "#002aff",
        },
        jobs: [],
        recurring_jobs: [],
        invoices: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123"]}>
        <ClientJobPortal />
      </MemoryRouter>,
    );

    const welcomeHeading = await screen.findByRole("heading", { name: /Welcome, Another import/i });
    expect(welcomeHeading).toHaveStyle({ color: "#002aff" });

    const subtext = screen.getByText("View your jobs and project details");
    expect(subtext).toHaveStyle({ color: "rgba(0, 42, 255, 0.78)" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
