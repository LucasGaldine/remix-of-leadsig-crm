import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useClientPortalController } from "@/pages/client-portal/useClientPortalController";

function ControllerProbe() {
  const controller = useClientPortalController();

  return (
    <div>
      <div data-testid="page-state">{controller.pageState}</div>
      <div data-testid="view-mode">{controller.viewMode}</div>
      <div data-testid="error-message">{controller.errorMessage}</div>
      <div data-testid="has-customer-data">{String(Boolean(controller.customerData))}</div>
      <div data-testid="has-portal-data">{String(Boolean(controller.data))}</div>
      <div data-testid="heading-font">{controller.headingFontOption?.name ?? ""}</div>
      <div data-testid="body-font">{controller.bodyFontOption?.name ?? ""}</div>
    </div>
  );
}

describe("useClientPortalController", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns error state when token is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal"]}>
        <ControllerProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-state")).toHaveTextContent("error");
    });

    expect(screen.getByTestId("error-message")).toHaveTextContent(
      "No share token provided. Please check the link you were sent.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets list mode when response contains jobs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customer: { name: "Client" },
        company: { company_name: "LeadSig" },
        jobs: [],
        recurring_jobs: [],
        invoices: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123"]}>
        <ControllerProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-state")).toHaveTextContent("loaded");
    });

    expect(screen.getByTestId("view-mode")).toHaveTextContent("job-list");
    expect(screen.getByTestId("has-customer-data")).toHaveTextContent("true");
    expect(screen.getByTestId("has-portal-data")).toHaveTextContent("false");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves fonts from company.website when settings.website is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        customer: { name: "Client" },
        company: {
          company_name: "LeadSig",
          website: {
            font: "Oswald",
            body_font: "Lora",
          },
        },
        jobs: [],
        recurring_jobs: [],
        invoices: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/portal?token=token_123"]}>
        <ControllerProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-state")).toHaveTextContent("loaded");
    });

    expect(screen.getByTestId("heading-font")).toHaveTextContent("Oswald");
    expect(screen.getByTestId("body-font")).toHaveTextContent("Lora");
  });

  it("sets detail mode when response is a job payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        job: {
          name: "Spring Cleanup",
          status: "job",
          created_at: "2026-04-01T00:00:00.000Z",
          customer: { name: "Sarah" },
        },
        company: { company_name: "LeadSig" },
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
        <ControllerProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-state")).toHaveTextContent("loaded");
    });

    expect(screen.getByTestId("view-mode")).toHaveTextContent("job-detail");
    expect(screen.getByTestId("has-customer-data")).toHaveTextContent("false");
    expect(screen.getByTestId("has-portal-data")).toHaveTextContent("true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
