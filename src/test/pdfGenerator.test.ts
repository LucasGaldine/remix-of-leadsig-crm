import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildTemplateDocumentPDFBlob, generateEstimatePDF, generateInvoicePDF } from "@/lib/pdfGenerator";

const jsPdfMock = vi.hoisted(() => ({
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  text: vi.fn(),
  setTextColor: vi.fn(),
  rect: vi.fn(),
  setFillColor: vi.fn(),
  splitTextToSize: vi.fn((value: string) => [value]),
  addPage: vi.fn(),
  setDrawColor: vi.fn(),
  line: vi.fn(),
  addImage: vi.fn(),
  getImageProperties: vi.fn(() => ({ width: 400, height: 400 })),
  save: vi.fn(),
  getTextWidth: vi.fn((value: string) => value.length * 5),
  output: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
  internal: {
    pageSize: {
      getWidth: vi.fn(() => 210),
      getHeight: vi.fn(() => 297),
    },
  },
}));

vi.mock("jspdf", () => ({
  default: vi.fn(() => jsPdfMock),
}));

describe("generateEstimatePDF", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));

    Object.values(jsPdfMock).forEach((value) => {
      if (typeof value === "function" && "mockReset" in value) {
        value.mockReset();
      }
    });
    jsPdfMock.internal.pageSize.getWidth.mockReturnValue(210);
    jsPdfMock.internal.pageSize.getHeight.mockReturnValue(297);
    jsPdfMock.splitTextToSize.mockImplementation((value: string) => [value]);
    jsPdfMock.getTextWidth.mockImplementation((value: string) => value.length * 5);
    jsPdfMock.output.mockReturnValue(new Blob(["pdf"], { type: "application/pdf" }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () =>
        ({
          type: "image/png",
          arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
        }) satisfies Pick<Blob, "type" | "arrayBuffer">,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds the company logo to the estimate PDF when a logo URL is provided", async () => {
    await generateEstimatePDF({
      customerName: "Taylor Smith",
      jobName: "Patio Build",
      companyName: "LeadSig",
      companyLogoUrl: "https://example.com/logo.png",
      lineItems: [
        {
          name: "Patio",
          quantity: 1,
          unit: "job",
          unit_price: 2500,
          total: 2500,
        },
      ],
      subtotal: 2500,
      taxRate: 0,
      tax: 0,
      discount: 0,
      total: 2500,
    });

    expect(fetch).toHaveBeenCalledWith("https://example.com/logo.png");
    expect(jsPdfMock.addImage).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/),
      expect.any(String),
      20,
      20,
      18,
      18,
    );
    expect(jsPdfMock.save).toHaveBeenCalledTimes(1);
  });

  it("adds a signature image on a separate page when signatureImageUrl is provided", async () => {
    await generateEstimatePDF({
      customerName: "Taylor Smith",
      jobName: "Patio Build",
      companyName: "LeadSig",
      signatureImageUrl: "https://example.com/signature.png",
      lineItems: [
        {
          name: "Patio",
          quantity: 1,
          unit: "job",
          unit_price: 2500,
          total: 2500,
        },
      ],
      subtotal: 2500,
      taxRate: 0,
      tax: 0,
      discount: 0,
      total: 2500,
    });

    expect(fetch).toHaveBeenCalledWith("https://example.com/signature.png");
    expect(jsPdfMock.addPage).toHaveBeenCalledTimes(1);
    expect(jsPdfMock.save).toHaveBeenCalledTimes(1);
  });

  it("generates an invoice pdf with invoice-specific labels and filename", async () => {
    await generateInvoicePDF({
      customerName: "Taylor Smith",
      jobName: "Patio Build",
      companyName: "LeadSig",
      invoiceNumber: 42,
      dueDate: "2026-03-31T00:00:00.000Z",
      lineItems: [
        {
          name: "Patio",
          description: "Install pavers",
          quantity: 1,
          unit: "job",
          unit_price: 2500,
          total: 2500,
        },
      ],
      subtotal: 2500,
      taxRate: 0.07,
      tax: 175,
      discount: 0,
      total: 2675,
      balanceDue: 2675,
      createdAt: "2026-03-23T12:00:00.000Z",
    });

    expect(jsPdfMock.text).toHaveBeenCalledWith("INVOICE", 20, expect.any(Number));
    expect(jsPdfMock.text).toHaveBeenCalledWith("Invoice #42", 20, expect.any(Number));
    expect(jsPdfMock.text).toHaveBeenCalledWith(expect.stringMatching(/^Due:/), 20, expect.any(Number));
    expect(jsPdfMock.text).toHaveBeenCalledWith("Balance Due:", expect.any(Number), expect.any(Number));
    expect(jsPdfMock.save).toHaveBeenCalledWith("invoice-taylor_smith-2026-03-23.pdf");
  });
});

describe("buildTemplateDocumentPDFBlob", () => {
  beforeEach(() => {
    Object.values(jsPdfMock).forEach((value) => {
      if (typeof value === "function" && "mockReset" in value) {
        value.mockReset();
      }
    });
    jsPdfMock.internal.pageSize.getWidth.mockReturnValue(612);
    jsPdfMock.internal.pageSize.getHeight.mockReturnValue(792);
    jsPdfMock.splitTextToSize.mockImplementation((value: string) => [value]);
    jsPdfMock.getTextWidth.mockImplementation((value: string) => value.length * 5);
    jsPdfMock.output.mockReturnValue(new Blob(["pdf"], { type: "application/pdf" }));
  });

  it("renders inline markdown emphasis with distinct PDF font calls", () => {
    const blob = buildTemplateDocumentPDFBlob({
      title: "Agreement",
      content: "**Name:** Taylor Client",
    });

    expect(blob).toBeInstanceOf(Blob);

    const labelCallIndex = jsPdfMock.text.mock.calls.findIndex(([text]) => text === "Name:");
    const labelInvocationOrder = jsPdfMock.text.mock.invocationCallOrder[labelCallIndex];
    let boldCallBeforeLabelIndex = -1;
    jsPdfMock.setFont.mock.calls.forEach((call, index) => {
      const [family, style] = call;
      if (
        family === "helvetica" &&
        style === "bold" &&
        jsPdfMock.setFont.mock.invocationCallOrder[index] < labelInvocationOrder
      ) {
        boldCallBeforeLabelIndex = index;
      }
    });
    const normalCallAfterLabelIndex = jsPdfMock.setFont.mock.calls.findIndex((call, index) => {
      const [family, style] = call;
      return (
        family === "helvetica" &&
        style === "normal" &&
        jsPdfMock.setFont.mock.invocationCallOrder[index] > labelInvocationOrder
      );
    });
    const valueCallIndex = jsPdfMock.text.mock.calls.findIndex(([text]) => text === " Taylor Client");

    expect(boldCallBeforeLabelIndex).toBeGreaterThanOrEqual(0);
    expect(labelInvocationOrder).toBeGreaterThan(jsPdfMock.setFont.mock.invocationCallOrder[boldCallBeforeLabelIndex]);
    expect(jsPdfMock.setFont.mock.invocationCallOrder[normalCallAfterLabelIndex]).toBeGreaterThan(labelInvocationOrder);
    expect(jsPdfMock.text.mock.invocationCallOrder[valueCallIndex]).toBeGreaterThan(
      jsPdfMock.setFont.mock.invocationCallOrder[normalCallAfterLabelIndex],
    );
  });
});
