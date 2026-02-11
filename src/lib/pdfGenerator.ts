import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface LineItem {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface EstimatePDFData {
  customerName: string;
  jobName: string;
  address?: string;
  companyName?: string;
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
  expiresAt?: string;
}

export function generateEstimatePDF(data: EstimatePDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTIMATE', margin, yPosition);

  yPosition += 15;
  const timestamp = format(new Date(), 'MMMM d, yyyy \'at\' h:mm a');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${timestamp}`, margin, yPosition);
  doc.setTextColor(0, 0, 0);

  yPosition += 15;

  if (data.companyName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(data.companyName, margin, yPosition);
    yPosition += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (data.companyEmail) {
      doc.text(data.companyEmail, margin, yPosition);
      yPosition += 5;
    }

    if (data.companyPhone) {
      doc.text(data.companyPhone, margin, yPosition);
      yPosition += 5;
    }

    yPosition += 5;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', margin, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'normal');
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

  yPosition += 10;

  if (data.createdAt) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Created: ${format(new Date(data.createdAt), 'MMM d, yyyy')}`, margin, yPosition);
    yPosition += 5;
  }

  if (data.expiresAt) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Expires: ${format(new Date(data.expiresAt), 'MMM d, yyyy')}`, margin, yPosition);
    yPosition += 5;
  }

  doc.setTextColor(0, 0, 0);
  yPosition += 5;

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition, pageWidth - margin * 2, 8, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 2, yPosition + 5);
  doc.text('Qty', pageWidth - 100, yPosition + 5);
  doc.text('Price', pageWidth - 70, yPosition + 5);
  doc.text('Total', pageWidth - margin - 2, yPosition + 5, { align: 'right' });

  yPosition += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  for (const item of data.lineItems) {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(item.name, margin, yPosition);
    yPosition += 5;

    if (item.description) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 20);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * 4;
      doc.setFontSize(10);
    }

    doc.setFont('helvetica', 'normal');
    const qtyText = `${item.quantity} ${item.unit}`;
    const priceText = `$${Number(item.unit_price).toFixed(2)}`;
    const totalText = `$${Number(item.total).toFixed(2)}`;

    doc.text(qtyText, pageWidth - 100, yPosition);
    doc.text(priceText, pageWidth - 70, yPosition);
    doc.text(totalText, pageWidth - margin - 2, yPosition, { align: 'right' });

    yPosition += 8;
  }

  yPosition += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  const summaryX = pageWidth - 80;
  doc.setFont('helvetica', 'normal');

  doc.text('Subtotal:', summaryX, yPosition);
  doc.text(`$${Number(data.subtotal).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  yPosition += 6;

  doc.text(`Tax (${(data.taxRate * 100).toFixed(1)}%):`, summaryX, yPosition);
  doc.text(`$${Number(data.tax).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  yPosition += 6;

  if (data.discount > 0) {
    doc.text('Discount:', summaryX, yPosition);
    doc.text(`-$${Number(data.discount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', summaryX, yPosition);
  doc.text(`$${Number(data.total).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

  if (data.notes) {
    yPosition += 15;

    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, yPosition);
    yPosition += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, yPosition);
  }

  const filename = `estimate-${data.customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
