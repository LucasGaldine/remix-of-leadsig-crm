import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientPortalEstimate } from "@/components/client-portal/ClientPortalEstimate";

const { generateEstimatePDF } = vi.hoisted(() => ({
  generateEstimatePDF: vi.fn(),
}));

vi.mock("@/lib/pdfGenerator", () => ({
  generateEstimatePDF,
}));

describe("ClientPortalEstimate", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
  const originalSetPointerCapture = HTMLCanvasElement.prototype.setPointerCapture;
  const originalReleasePointerCapture = HTMLCanvasElement.prototype.releasePointerCapture;
  const originalHasPointerCapture = HTMLCanvasElement.prototype.hasPointerCapture;

  const setupSignatureCanvasMocks = () => {
    const contextMock = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      clearRect: vi.fn(),
      lineCap: "round",
      lineJoin: "round",
      strokeStyle: "#0f172a",
      lineWidth: 2,
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => contextMock as unknown as CanvasRenderingContext2D);
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,signature123");
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
    HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => true);
  };

  const drawSignature = () => {
    const canvas = screen.getByLabelText("Signature pad");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 300,
        height: 120,
        right: 300,
        bottom: 120,
      }),
      configurable: true,
    });

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 50, pointerId: 1 });
  };

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,default");
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
    HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => true);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
    HTMLCanvasElement.prototype.setPointerCapture = originalSetPointerCapture;
    HTMLCanvasElement.prototype.releasePointerCapture = originalReleasePointerCapture;
    HTMLCanvasElement.prototype.hasPointerCapture = originalHasPointerCapture;
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
    setupSignatureCanvasMocks();
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
    drawSignature();
    fireEvent.click(screen.getByRole("button", { name: /Submit Approval/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const requestOptions = fetchMock.mock.calls[0][1] as { body: string };
    expect(JSON.parse(requestOptions.body)).toMatchObject({
      action: "approve",
      estimate_version_id: "ver_2",
    });
  });

  it("renders line items under each version card and applies portal colors to the selected card", () => {
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
          line_items: [],
          estimate_versions: [
            {
              id: "ver_1",
              name: "Starter",
              subtotal: 1000,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1000,
              line_items: [
                {
                  id: "starter_item",
                  name: "Cleanup Package",
                  quantity: 1,
                  unit: "job",
                  unit_price: 1000,
                  total: 1000,
                },
              ],
            },
            {
              id: "ver_2",
              name: "Premium",
              subtotal: 1250,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1250,
              line_items: [
                {
                  id: "premium_item",
                  name: "Cleanup Package",
                  quantity: 1,
                  unit: "job",
                  unit_price: 1250,
                  total: 1250,
                },
              ],
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
        portalColor="#1F7A8C"
        portalTextColor="#F8FAFC"
      />,
    );

    expect(screen.getAllByText("Cleanup Package")).toHaveLength(2);

    const selectedCard = screen.getByRole("button", { name: /Premium/i });
    expect(selectedCard).toHaveStyle({
      backgroundColor: "#1F7A8C",
      color: "#F8FAFC",
    });
  });

  it("uses contain mode for portrait project visualization images", () => {
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
          line_items: [],
          project_visualization_image_url: "https://example.com/portrait.jpg",
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    const image = screen.getByAltText("Project visualization");
    Object.defineProperty(image, "naturalWidth", { value: 800, configurable: true });
    Object.defineProperty(image, "naturalHeight", { value: 1200, configurable: true });
    fireEvent.load(image);

    expect(image.className).toContain("object-contain");
  });

  it("shows estimate version cards in a finite carousel when there are more than three versions", () => {
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
              name: "Option 1",
              subtotal: 1000,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1000,
              line_items: [],
            },
            {
              id: "ver_2",
              name: "Option 2",
              subtotal: 1200,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1200,
              line_items: [],
            },
            {
              id: "ver_3",
              name: "Option 3",
              subtotal: 1300,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1300,
              line_items: [],
            },
            {
              id: "ver_4",
              name: "Option 4",
              subtotal: 1400,
              tax_rate: 0,
              tax: 0,
              discount: 0,
              total: 1400,
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

    const previousButton = screen.getByRole("button", { name: /Previous options/i });
    const nextButton = screen.getByRole("button", { name: /Next options/i });

    expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 4")).toBeInTheDocument();
    expect(nextButton).toBeDisabled();
    expect(previousButton).not.toBeDisabled();

    fireEvent.click(previousButton);

    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it("folds profit margin into displayed line items and subtotal for clients", () => {
    render(
      <ClientPortalEstimate
        estimate={{
          total: 132,
          subtotal: 100,
          profit_margin: 20,
          tax_rate: 0.1,
          tax: 12,
          discount: 0,
          status: "sent",
          updated_at: "2026-03-23T00:00:00.000Z",
          line_items: [
            {
              id: "item_1",
              name: "Labor",
              quantity: 1,
              unit: "job",
              unit_price: 50,
              total: 50,
            },
            {
              id: "item_2",
              name: "Materials",
              quantity: 1,
              unit: "job",
              unit_price: 50,
              total: 50,
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Profit Margin/i)).not.toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getAllByText("$60.00")).toHaveLength(2);
  });

  it("uses profit-adjusted line items and subtotal when downloading approved estimate PDF", () => {
    render(
      <ClientPortalEstimate
        estimate={{
          total: 13440,
          subtotal: 10000,
          profit_margin: 20,
          tax_rate: 0.12,
          tax: 1440,
          discount: 0,
          status: "accepted",
          updated_at: "2026-03-23T00:00:00.000Z",
          line_items: [
            {
              id: "item_1",
              name: "Black Mulch",
              quantity: 1000,
              unit: "sq ft",
              unit_price: 10,
              total: 10000,
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));

    expect(generateEstimatePDF).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 12000,
        lineItems: [
          expect.objectContaining({
            name: "Black Mulch",
            unit_price: 12,
            total: 12000,
          }),
        ],
      }),
    );
  });

  it("keeps pending change-order review visible even when original snapshot data is missing", () => {
    render(
      <ClientPortalEstimate
        estimate={{
          total: 1250,
          subtotal: 1250,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          status: "accepted",
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
          has_pending_changes: true,
          original_total: null,
          original_line_items: null,
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Changes Requiring Approval")).toBeInTheDocument();
    expect(screen.getByText("Proposed Changes (Awaiting Approval)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve Changes/i })).toBeInTheDocument();
  });

  it("shows the change-order total delta when original totals are available", () => {
    render(
      <ClientPortalEstimate
        estimate={{
          total: 140,
          subtotal: 140,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          status: "accepted",
          updated_at: "2026-03-23T00:00:00.000Z",
          line_items: [
            {
              id: "item_current",
              name: "Scope Update",
              quantity: 1,
              unit: "job",
              unit_price: 140,
              total: 140,
            },
          ],
          has_pending_changes: true,
          original_total: 100,
          original_subtotal: 100,
          original_tax: 0,
          original_discount: 0,
          original_line_items: [
            {
              id: "item_original",
              name: "Original Scope",
              quantity: 1,
              unit: "job",
              unit_price: 100,
              total: 100,
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(/Change Order Total: \+\$40\.00/i)).toBeInTheDocument();
  });

  it("includes signature_data_url when approving with a drawn signature", async () => {
    setupSignatureCanvasMocks();
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
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Approve$/i }));
    drawSignature();
    fireEvent.click(screen.getByRole("button", { name: /Submit Approval/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const requestOptions = fetchMock.mock.calls[0][1] as { body: string };
    expect(JSON.parse(requestOptions.body)).toMatchObject({
      action: "approve",
      signature_data_url: "data:image/png;base64,signature123",
    });
  });

  it("does not send signature_data_url when declining", async () => {
    setupSignatureCanvasMocks();
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
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Decline$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const requestOptions = fetchMock.mock.calls[0][1] as { body: string };
    const payload = JSON.parse(requestOptions.body);
    expect(payload.action).toBe("decline");
    expect(payload).not.toHaveProperty("signature_data_url");
  });

  it("includes signature_data_url when approving pending changes", async () => {
    setupSignatureCanvasMocks();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClientPortalEstimate
        estimate={{
          total: 140,
          subtotal: 140,
          tax_rate: 0,
          tax: 0,
          discount: 0,
          status: "accepted",
          updated_at: "2026-03-23T00:00:00.000Z",
          line_items: [
            {
              id: "item_current",
              name: "Scope Update",
              quantity: 1,
              unit: "job",
              unit_price: 140,
              total: 140,
            },
          ],
          has_pending_changes: true,
          original_total: 100,
          original_subtotal: 100,
          original_tax: 0,
          original_discount: 0,
          original_line_items: [
            {
              id: "item_original",
              name: "Original Scope",
              quantity: 1,
              unit: "job",
              unit_price: 100,
              total: 100,
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Approve Changes/i }));
    drawSignature();
    fireEvent.click(screen.getByRole("button", { name: /Submit Approval/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const requestOptions = fetchMock.mock.calls[0][1] as { body: string };
    expect(JSON.parse(requestOptions.body)).toMatchObject({
      action: "approve_changes",
      signature_data_url: "data:image/png;base64,signature123",
    });
  });

  it("shows estimate-approval documents plus already sent manual documents", () => {
    render(
      <ClientPortalEstimate
        estimate={{
          id: "estimate_1",
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
          job_document_configs: [
            {
              id: "cfg_job",
              lead_id: "lead_1",
              template_id: "tpl_job",
              include_in_job: true,
              email_timing: "on_estimate_approval",
              requires_signature: true,
              sort_order: 1,
              template: {
                id: "tpl_job",
                name: "Job Agreement",
                system_key: "job_agreement",
                body: "Job agreement body",
              },
            },
            {
              id: "cfg_warranty",
              lead_id: "lead_1",
              template_id: "tpl_warranty",
              include_in_job: true,
              email_timing: "on_estimate_approval",
              requires_signature: true,
              sort_order: 2,
              template: {
                id: "tpl_warranty",
                name: "Warranty Agreement",
                system_key: "warranty_agreement",
                body: "Warranty body",
              },
            },
            {
              id: "cfg_custom",
              lead_id: "lead_1",
              template_id: "tpl_custom",
              include_in_job: true,
              email_timing: "on_estimate_approval",
              requires_signature: true,
              sort_order: 3,
              template: {
                id: "tpl_custom",
                name: "Test Estimate Approval",
                system_key: null,
                body: "Custom body",
              },
            },
            {
              id: "cfg_manual_sent",
              lead_id: "lead_1",
              template_id: "tpl_manual",
              include_in_job: true,
              email_timing: "manual",
              requires_signature: true,
              sort_order: 4,
              template: {
                id: "tpl_manual",
                name: "Manual Signed Addendum",
                system_key: null,
                body: "Manual body",
              },
            },
            {
              id: "cfg_manual_unsent",
              lead_id: "lead_1",
              template_id: "tpl_manual_unsent",
              include_in_job: true,
              email_timing: "manual",
              requires_signature: true,
              sort_order: 5,
              template: {
                id: "tpl_manual_unsent",
                name: "Manual Unsent Document",
                system_key: null,
                body: "Manual unsent body",
              },
            },
          ],
          job_documents: [
            {
              id: "doc_manual_1",
              lead_id: "lead_1",
              template_id: "tpl_manual",
              config_id: "cfg_manual_sent",
              document_key: "manual_signed_addendum",
              file_name: "manual-signed-addendum.pdf",
              file_path: "path/manual-signed-addendum.pdf",
              mime_type: "application/pdf",
              created_at: "2026-03-22T00:00:00.000Z",
              url: "https://example.com/manual-signed-addendum.pdf",
            },
          ],
        }}
        token="token_123"
        apiUrl="https://example.com"
        apiHeaders={{ "Content-Type": "application/json" }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Job Agreement")).toBeInTheDocument();
    expect(screen.getByText("Warranty Agreement")).toBeInTheDocument();
    expect(screen.getByText("Test Estimate Approval")).toBeInTheDocument();
    expect(screen.getByText("Manual Signed Addendum")).toBeInTheDocument();
    expect(screen.queryByText("Manual Unsent Document")).not.toBeInTheDocument();
    expect(screen.queryByText("No approval or manually sent documents are available yet.")).not.toBeInTheDocument();
  });

});
