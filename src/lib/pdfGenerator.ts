import jsPDF from "jspdf";
import { format } from "date-fns";

interface LineItem {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface PdfBaseData {
  customerName: string;
  jobName: string;
  address?: string;
  companyName?: string;
  companyLogoUrl?: string;
  companyEmail?: string;
  companyPhone?: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  createdAt?: string;
}

export interface EstimatePDFData extends PdfBaseData {
  expiresAt?: string;
  signatureImageUrl?: string;
}

export interface InvoicePDFData extends PdfBaseData {
  invoiceNumber?: number | string;
  dueDate?: string;
  balanceDue?: number;
}

export interface TemplateDocumentPDFData {
  title: string;
  content: string;
  fileName?: string;
  requiresSignature?: boolean;
  signatureImageUrl?: string;
  signedAt?: string;
}

async function getImageDataUrl(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to load company logo");
  }

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

function resolveImageFormat(imageDataUrl: string) {
  if (imageDataUrl.startsWith("data:image/jpeg") || imageDataUrl.startsWith("data:image/jpg")) {
    return "JPEG";
  }

  if (imageDataUrl.startsWith("data:image/webp")) {
    return "WEBP";
  }

  return "PNG";
}

async function addCompanyLogo(doc: jsPDF, logoUrl: string | undefined, margin: number, yPosition: number) {
  if (!logoUrl) return yPosition;

  try {
    const logoDataUrl = await getImageDataUrl(logoUrl);
    const logoProps = doc.getImageProperties(logoDataUrl);
    const maxLogoWidth = 36;
    const maxLogoHeight = 18;
    const widthScale = maxLogoWidth / logoProps.width;
    const heightScale = maxLogoHeight / logoProps.height;
    const logoScale = Math.min(widthScale, heightScale);
    const logoWidth = logoProps.width * logoScale;
    const logoHeight = logoProps.height * logoScale;

    doc.addImage(logoDataUrl, "PNG", margin, yPosition, logoWidth, logoHeight);
    return yPosition + logoHeight + 6;
  } catch {
    return yPosition;
  }
}

function addHeader(doc: jsPDF, title: string, margin: number, yPosition: number) {
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, yPosition);
  return yPosition + 15;
}

function addGeneratedTimestamp(doc: jsPDF, margin: number, yPosition: number) {
  const timestamp = format(new Date(), "MMMM d, yyyy 'at' h:mm a");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${timestamp}`, margin, yPosition);
  doc.setTextColor(0, 0, 0);
  return yPosition + 15;
}

function addCompanySection(doc: jsPDF, data: PdfBaseData, margin: number, yPosition: number) {
  if (!data.companyName) return yPosition;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName, margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  if (data.companyEmail) {
    doc.text(data.companyEmail, margin, yPosition);
    yPosition += 5;
  }

  if (data.companyPhone) {
    doc.text(data.companyPhone, margin, yPosition);
    yPosition += 5;
  }

  return yPosition + 5;
}

function addRecipientSection(doc: jsPDF, label: string, data: PdfBaseData, margin: number, yPosition: number) {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(label, margin, yPosition);
  yPosition += 6;

  doc.setFont("helvetica", "normal");
  doc.text(data.customerName, margin, yPosition);
  yPosition += 5;

  if (data.jobName) {
    doc.text(data.jobName, margin, yPosition);
    yPosition += 5;
  }

  if (data.address) {
    doc.text(data.address, margin, yPosition);
    yPosition += 5;
  }

  return yPosition + 10;
}

function addDocumentMeta(
  doc: jsPDF,
  lines: string[],
  margin: number,
  yPosition: number,
) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  for (const line of lines) {
    doc.text(line, margin, yPosition);
    yPosition += 5;
  }

  doc.setTextColor(0, 0, 0);
  return yPosition + 5;
}

function addLineItemsTable(doc: jsPDF, data: PdfBaseData, margin: number, pageWidth: number, yPosition: number) {
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition, pageWidth - margin * 2, 8, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 2, yPosition + 5);
  doc.text("Qty", pageWidth - 100, yPosition + 5);
  doc.text("Price", pageWidth - 70, yPosition + 5);
  doc.text("Total", pageWidth - margin - 2, yPosition + 5, { align: "right" });

  yPosition += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (const item of data.lineItems) {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.text(item.name, margin, yPosition);
    yPosition += 5;

    if (item.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 20);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * 4;
      doc.setFontSize(10);
    }

    doc.setFont("helvetica", "normal");
    doc.text(`${item.quantity} ${item.unit}`, pageWidth - 100, yPosition);
    doc.text(`$${Number(item.unit_price).toFixed(2)}`, pageWidth - 70, yPosition);
    doc.text(`$${Number(item.total).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });

    yPosition += 8;
  }

  return yPosition;
}

function addSummary(
  doc: jsPDF,
  data: PdfBaseData,
  margin: number,
  pageWidth: number,
  yPosition: number,
  extraRows: Array<{ label: string; value: string; emphasized?: boolean }> = [],
) {
  yPosition += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  const summaryX = pageWidth - 80;
  doc.setFont("helvetica", "normal");

  doc.text("Subtotal:", summaryX, yPosition);
  doc.text(`$${Number(data.subtotal).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 6;

  doc.text(`Tax (${(data.taxRate * 100).toFixed(1)}%):`, summaryX, yPosition);
  doc.text(`$${Number(data.tax).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 6;

  if (data.discount > 0) {
    doc.text("Discount:", summaryX, yPosition);
    doc.text(`-$${Number(data.discount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
    yPosition += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total:", summaryX, yPosition);
  doc.text(`$${Number(data.total).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 8;

  for (const row of extraRows) {
    doc.setFont("helvetica", row.emphasized ? "bold" : "normal");
    doc.setFontSize(row.emphasized ? 12 : 10);
    doc.text(row.label, summaryX, yPosition);
    doc.text(row.value, pageWidth - margin - 2, yPosition, { align: "right" });
    yPosition += row.emphasized ? 7 : 6;
  }

  return yPosition;
}

function addNotes(doc: jsPDF, notes: string | undefined, margin: number, pageWidth: number, yPosition: number) {
  if (!notes) return yPosition;

  yPosition += 15;
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Notes:", margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const notesLines = doc.splitTextToSize(notes, pageWidth - margin * 2);
  doc.text(notesLines, margin, yPosition);
  return yPosition + notesLines.length * 4;
}

async function addSignaturePage(
  doc: jsPDF,
  signatureImageUrl: string | undefined,
  margin: number,
  pageWidth: number,
  pageHeight: number,
) {
  if (!signatureImageUrl) return;

  try {
    const signatureDataUrl = await getImageDataUrl(signatureImageUrl);
    const signatureProps = doc.getImageProperties(signatureDataUrl);
    const imageFormat = resolveImageFormat(signatureDataUrl);

    doc.addPage();
    let yPosition = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Signature", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Captured during estimate approval", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 8;

    const maxImageWidth = pageWidth - margin * 2;
    const maxImageHeight = pageHeight - yPosition - margin;
    const widthScale = maxImageWidth / signatureProps.width;
    const heightScale = maxImageHeight / signatureProps.height;
    const imageScale = Math.min(widthScale, heightScale);
    const imageWidth = signatureProps.width * imageScale;
    const imageHeight = signatureProps.height * imageScale;
    const imageX = (pageWidth - imageWidth) / 2;

    doc.addImage(signatureDataUrl, imageFormat, imageX, yPosition, imageWidth, imageHeight);
  } catch {
    // Keep PDF generation resilient when signature image fails to load.
  }
}

export async function generateEstimatePDF(data: EstimatePDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = 20;

  yPosition = await addCompanyLogo(doc, data.companyLogoUrl, margin, yPosition);
  yPosition = addHeader(doc, "ESTIMATE", margin, yPosition);
  yPosition = addGeneratedTimestamp(doc, margin, yPosition);
  yPosition = addCompanySection(doc, data, margin, yPosition);
  yPosition = addRecipientSection(doc, "BILL TO:", data, margin, yPosition);

  const metaLines: string[] = [];
  if (data.createdAt) metaLines.push(`Created: ${format(new Date(data.createdAt), "MMM d, yyyy")}`);
  if (data.expiresAt) metaLines.push(`Expires: ${format(new Date(data.expiresAt), "MMM d, yyyy")}`);
  if (metaLines.length > 0) {
    yPosition = addDocumentMeta(doc, metaLines, margin, yPosition);
  }

  yPosition = addLineItemsTable(doc, data, margin, pageWidth, yPosition);
  yPosition = addSummary(doc, data, margin, pageWidth, yPosition);
  addNotes(doc, data.notes, margin, pageWidth, yPosition);
  await addSignaturePage(doc, data.signatureImageUrl, margin, pageWidth, pageHeight);

  const filename = `estimate-${data.customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

export async function generateInvoicePDF(data: InvoicePDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  yPosition = await addCompanyLogo(doc, data.companyLogoUrl, margin, yPosition);
  yPosition = addHeader(doc, "INVOICE", margin, yPosition);
  yPosition = addGeneratedTimestamp(doc, margin, yPosition);
  yPosition = addCompanySection(doc, data, margin, yPosition);
  yPosition = addRecipientSection(doc, "BILL TO:", data, margin, yPosition);

  const metaLines: string[] = [];
  if (data.invoiceNumber) metaLines.push(`Invoice #${data.invoiceNumber}`);
  if (data.createdAt) metaLines.push(`Issued: ${format(new Date(data.createdAt), "MMM d, yyyy")}`);
  if (data.dueDate) metaLines.push(`Due: ${format(new Date(data.dueDate), "MMM d, yyyy")}`);
  yPosition = addDocumentMeta(doc, metaLines, margin, yPosition);

  yPosition = addLineItemsTable(doc, data, margin, pageWidth, yPosition);
  yPosition = addSummary(doc, data, margin, pageWidth, yPosition, [
    {
      label: "Balance Due:",
      value: `$${Number(data.balanceDue ?? data.total).toFixed(2)}`,
      emphasized: true,
    },
  ]);
  addNotes(doc, data.notes, margin, pageWidth, yPosition);

  const filename = `invoice-${data.customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

function sanitizePdfBaseName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}

type MarkdownLineStyle = "h1" | "h2" | "h3" | "bullet" | "ordered" | "paragraph";
type PdfInlineFontStyle = "normal" | "bold" | "italic";
type PdfInlineSegment = {
  text: string;
  fontStyle: PdfInlineFontStyle;
};

function stripInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

function normalizeDocumentLine(line: string): { text: string; style: MarkdownLineStyle } {
  const trimmed = line.trim();
  if (!trimmed) return { text: "", style: "paragraph" };

  if (/^###\s+/.test(trimmed)) {
    return { text: trimmed.replace(/^###\s+/, ""), style: "h3" };
  }
  if (/^##\s+/.test(trimmed)) {
    return { text: trimmed.replace(/^##\s+/, ""), style: "h2" };
  }
  if (/^#\s+/.test(trimmed)) {
    return { text: trimmed.replace(/^#\s+/, ""), style: "h1" };
  }
  if (/^\s*[-*]\s+/.test(trimmed)) {
    return { text: `• ${trimmed.replace(/^\s*[-*]\s+/, "")}`, style: "bullet" };
  }
  if (/^\s*\d+\.\s+/.test(trimmed)) {
    return { text: trimmed.replace(/^\s*(\d+)\.\s+/, "$1. "), style: "ordered" };
  }
  return { text: trimmed, style: "paragraph" };
}

function parseInlineMarkdownSegments(value: string): PdfInlineSegment[] {
  const segments: PdfInlineSegment[] = [];
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: value.slice(lastIndex, match.index), fontStyle: "normal" });
    }

    const boldText = match[2] || match[3];
    const codeText = match[4];
    const italicText = match[5] || match[6];
    if (boldText) {
      segments.push({ text: boldText, fontStyle: "bold" });
    } else if (codeText) {
      segments.push({ text: codeText, fontStyle: "normal" });
    } else if (italicText) {
      segments.push({ text: italicText, fontStyle: "italic" });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) {
    segments.push({ text: value.slice(lastIndex), fontStyle: "normal" });
  }

  return segments.filter((segment) => segment.text.length > 0);
}

function hasInlineMarkdownFormatting(value: string) {
  return /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/.test(value);
}

function setTemplateDocumentLineFont(doc: jsPDF, style: MarkdownLineStyle, inlineStyle: PdfInlineFontStyle = "normal") {
  if (style === "h1") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
  } else if (style === "h2") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
  } else if (style === "h3") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
  } else {
    doc.setFont("helvetica", inlineStyle);
    doc.setFontSize(11);
  }
}

function renderInlineMarkdownPdfLine(
  doc: jsPDF,
  text: string,
  style: MarkdownLineStyle,
  margin: number,
  y: number,
) {
  const segments = parseInlineMarkdownSegments(text);
  let x = margin;

  for (const segment of segments) {
    const inlineStyle =
      style === "paragraph" || style === "bullet" || style === "ordered"
        ? segment.fontStyle
        : "bold";
    setTemplateDocumentLineFont(doc, style, inlineStyle);
    doc.text(segment.text, x, y);
    x += doc.getTextWidth(segment.text);
  }
}

function formatSignedDateLabel(value: string | undefined) {
  if (!value) return format(new Date(), "MMMM d, yyyy");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return format(new Date(), "MMMM d, yyyy");
  return format(date, "MMMM d, yyyy");
}

function createTemplateDocumentPdf(data: TemplateDocumentPDFData, signatureDataUrl?: string | null) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 16;
  const rawContent = String(data.content || "").replace(/\r\n/g, "\n");
  if (!rawContent.trim()) return null;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.title || "Document", margin, margin);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, margin, margin + 18);
  doc.setTextColor(0, 0, 0);

  let y = margin + 42;
  const lines = rawContent.split(/\n/);

  const ensurePageRoom = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  for (const line of lines) {
    const { text, style } = normalizeDocumentLine(line);
    if (!text) {
      y += Math.floor(lineHeight / 2);
      continue;
    }

    setTemplateDocumentLineFont(doc, style);
    const plainText = stripInlineMarkdown(text);
    const wrapped = doc.splitTextToSize(plainText, maxWidth) as string[];
    ensurePageRoom(Math.max(lineHeight, wrapped.length * lineHeight));
    for (const segment of wrapped) {
      if (wrapped.length === 1 && hasInlineMarkdownFormatting(text)) {
        renderInlineMarkdownPdfLine(doc, text, style, margin, y);
      } else {
        setTemplateDocumentLineFont(doc, style);
        doc.text(segment, margin, y);
      }
      y += lineHeight;
    }
    if (style === "h1" || style === "h2" || style === "h3") {
      y += 4;
    }
  }

  if (data.requiresSignature) {
    ensurePageRoom(100);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Signature", margin, y);
    y += 22;

    const dateX = margin + 300;
    const dateLineY = y;
    if (signatureDataUrl) {
      try {
        const signatureProps = doc.getImageProperties(signatureDataUrl);
        const imageFormat = resolveImageFormat(signatureDataUrl);
        const maxSignatureWidth = 260;
        const maxSignatureHeight = 52;
        const widthScale = maxSignatureWidth / signatureProps.width;
        const heightScale = maxSignatureHeight / signatureProps.height;
        const imageScale = Math.min(widthScale, heightScale);
        const imageWidth = signatureProps.width * imageScale;
        const imageHeight = signatureProps.height * imageScale;
        doc.addImage(signatureDataUrl, imageFormat, margin, y - imageHeight + 6, imageWidth, imageHeight);
      } catch {
        // Keep the signed date/labels when the signature image cannot be embedded.
      }
    } else {
      doc.setDrawColor(120, 120, 120);
      doc.line(margin, y, margin + 260, y);
    }

    doc.setDrawColor(120, 120, 120);
    doc.line(dateX, dateLineY, dateX + 140, dateLineY);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text("Client Signature", margin, y);
    doc.text("Date", dateX, y);
    if (data.signedAt) {
      doc.setFontSize(9);
      doc.text(formatSignedDateLabel(data.signedAt), dateX, y + 12);
    }
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

export function generateTemplateDocumentPDF(data: TemplateDocumentPDFData) {
  const doc = createTemplateDocumentPdf(data);
  if (!doc) return;
  const baseName = sanitizePdfBaseName(data.fileName || data.title || "document");
  doc.save(`${baseName}.pdf`);
}

export function buildTemplateDocumentPDFBlob(data: TemplateDocumentPDFData) {
  const doc = createTemplateDocumentPdf(data);
  if (!doc) return null;
  return doc.output("blob");
}

export async function buildSignedTemplateDocumentPDFBlob(data: TemplateDocumentPDFData) {
  let signatureDataUrl: string | null = null;
  if (data.signatureImageUrl) {
    try {
      signatureDataUrl = await getImageDataUrl(data.signatureImageUrl);
    } catch {
      signatureDataUrl = null;
    }
  }

  const doc = createTemplateDocumentPdf(data, signatureDataUrl);
  if (!doc) return null;
  return doc.output("blob");
}
