import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ClientJobPortal from "@/pages/ClientJobPortal";

describe("ClientJobPortal theming", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']").forEach((link) => link.remove());
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

  it("uses portal color and text color on the client portal welcome header card", async () => {
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

  it("sets the browser tab title to Customer Name | Client Portal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customer: {
          name: "Another import",
        },
        company: {
          company_name: "LG Contracting",
        },
        jobs: [],
        recurring_jobs: [],
        invoices: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    document.title = "LeadSig";

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123"]}>
        <ClientJobPortal />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Welcome, Another import/i });

    expect(document.title).toBe("Another import | Client Portal");
  });

  it("falls back to Client Portal tab title when customer name is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customer: {
          name: "",
        },
        company: {},
        jobs: [],
        recurring_jobs: [],
        invoices: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    document.title = "LeadSig";

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123"]}>
        <ClientJobPortal />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Welcome,/i });

    expect(document.title).toBe("Client Portal");
  });

  it("shows Home and Jobs tabs with current jobs, pending signatures, and unpaid invoices", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customer: {
          name: "Another import",
        },
        company: {
          company_name: "LG Contracting",
        },
        jobs: [
          {
            id: "job_old",
            name: "Old Job",
            status: "completed",
            created_at: "2026-03-01T00:00:00.000Z",
          },
          {
            id: "job_new",
            name: "New Job",
            status: "job",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        recurring_jobs: [],
        invoices: [
          {
            id: "inv_unpaid",
            lead_id: "job_new",
            job_name: "New Job",
            stripe_invoice_url: "https://example.com/invoice",
            status: "open",
            total: 200,
            created_at: "2026-04-02T00:00:00.000Z",
          },
          {
            id: "inv_paid",
            lead_id: "job_old",
            job_name: "Old Job",
            stripe_invoice_url: "https://example.com/invoice-paid",
            status: "paid",
            total: 100,
            created_at: "2026-03-02T00:00:00.000Z",
          },
        ],
        required_documents: [
          {
            id: "doc_1",
            job_id: "job_new",
            job_name: "New Job",
            title: "Service Agreement",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123"]}>
        <ClientJobPortal />
      </MemoryRouter>,
    );

    await screen.findByRole("tab", { name: /Home/i });
    await screen.findByRole("tab", { name: /Jobs/i });

    expect(screen.getByRole("heading", { name: /Current Jobs/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Mar 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Documents Requiring Signature/i })).toBeInTheDocument();
    expect(screen.getByText(/Service Agreement/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Unpaid Invoices/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pay/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^View$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Current Projects/i })).not.toBeInTheDocument();
  });

  it("hides Documents Requiring Signature section when no required documents exist", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customer: {
          name: "Another import",
        },
        company: {
          company_name: "LG Contracting",
        },
        jobs: [
          {
            id: "job_new",
            name: "New Job",
            status: "job",
            created_at: "2026-04-01T00:00:00.000Z",
          },
        ],
        recurring_jobs: [],
        invoices: [],
        required_documents: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123"]}>
        <ClientJobPortal />
      </MemoryRouter>,
    );

    await screen.findByRole("tab", { name: /Home/i });

    expect(screen.queryByRole("heading", { name: /Documents Requiring Signature/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/No documents currently require signature/i)).not.toBeInTheDocument();
  });

  it("uses company logo as portal favicon when logo_url is present", async () => {
    const logoUrl = "https://cdn.example.com/company-logo.png";
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
          logo_url: logoUrl,
        },
        schedules: [],
        estimate_visit_schedules: [],
        estimate: null,
        invoice: null,
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

    await screen.findByRole("heading", { name: /Spring Cleanup/i });

    expect(document.head.querySelector("link[rel='icon']")?.getAttribute("href")).toBe(logoUrl);
    expect(document.head.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href")).toBe(logoUrl);
  });

  it("falls back to default favicon when company logo_url is missing", async () => {
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
        },
        schedules: [],
        estimate_visit_schedules: [],
        estimate: null,
        invoice: null,
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

    await screen.findByRole("heading", { name: /Spring Cleanup/i });

    expect(document.head.querySelector("link[rel='icon']")?.getAttribute("href")).toBe("/logo.png");
    expect(document.head.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href")).toBe("/logo.png");
  });
});
