import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface ReportColumn {
  key: string;
  header: string;
}

export function toCsvBuffer(columns: ReportColumn[], rows: Record<string, unknown>[]): Buffer {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    columns.map((c) => escape(c.header)).join(','),
    ...rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')),
  ];
  return Buffer.from(lines.join('\n'), 'utf-8');
}

export async function toExcelBuffer(columns: ReportColumn[], rows: Record<string, unknown>[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 2) }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function toPdfBuffer(title: string, columns: ReportColumn[], rows: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(9);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;

    const drawRow = (values: string[], bold: boolean) => {
      const y = doc.y;
      values.forEach((v, i) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(v, doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          ellipsis: true,
        });
      });
      doc.moveDown(1);
    };

    drawRow(columns.map((c) => c.header), true);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.3);

    for (const row of rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
      drawRow(columns.map((c) => String(row[c.key] ?? '')), false);
    }

    doc.end();
  });
}

export interface PurchaseOrderPdfData {
  poNumber: string;
  outletName: string;
  vendor: { name: string } | null;
  status: string;
  orderDate: Date;
  expectedDate: Date | null;
  invoiceNumber: string | null;
  taxAmount: number;
  totalAmount: number;
  items: {
    itemName: string;
    quantity: number;
    unit: string | null;
    rate: number;
    amount: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    receivedQty: number;
    pendingQty: number;
  }[];
}

/**
 * A purchase order as a document, not a report — header block, line items, totals —
 * mirroring PurchaseOrderDetailDialog. Portrait (toPdfBuffer is landscape) with explicit
 * column widths, since item names need far more room than the numeric columns.
 */
export function toPurchaseOrderPdf(po: PurchaseOrderPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const fullWidth = right - left;
    const date = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    // Rupee glyph isn't in pdfkit's built-in Helvetica, so amounts are prefixed "Rs." instead.
    const money = (n: number) => `Rs. ${n.toFixed(2)}`;

    doc.font('Helvetica-Bold').fontSize(18).text(po.poNumber, left, doc.y);
    doc.moveDown(0.8);

    const fields: [string, string][] = [
      ['Outlet', po.outletName],
      ['Vendor', po.vendor?.name ?? '—'],
      ['Status', po.status.replace('_', ' ')],
      ['Order Date', date(po.orderDate)],
      ['Expected Date', date(po.expectedDate)],
      ['Invoice #', po.invoiceNumber ?? '—'],
    ];
    const fieldWidth = fullWidth / 3;
    for (let i = 0; i < fields.length; i += 3) {
      const rowTop = doc.y;
      fields.slice(i, i + 3).forEach(([label, value], col) => {
        const x = left + col * fieldWidth;
        doc.font('Helvetica').fontSize(8).fillColor('#666').text(label, x, rowTop, { width: fieldWidth - 8 });
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(value, x, rowTop + 11, {
          width: fieldWidth - 8,
          ellipsis: true,
        });
      });
      doc.y = rowTop + 30;
    }

    doc.moveDown(0.4);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(0.5);

    // Item takes whatever the six numeric columns don't.
    const numeric = [58, 62, 66, 58, 56, 52];
    const itemWidth = fullWidth - numeric.reduce((a, b) => a + b, 0);
    const widths = [itemWidth, ...numeric];
    const headers = ['Item', 'Qty', 'Rate', 'Amount', 'GST', 'Received', 'Pending'];

    const drawRow = (values: string[], bold: boolean) => {
      const top = doc.y;
      let x = left;
      values.forEach((v, i) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).text(v, x, top, {
          width: widths[i] - 4,
          align: i === 0 ? 'left' : 'right',
          ellipsis: true,
        });
        x += widths[i];
      });
      doc.y = top + 16;
    };

    const drawHeader = () => {
      drawRow(headers, true);
      doc.moveTo(left, doc.y - 4).lineTo(right, doc.y - 4).stroke();
      doc.moveDown(0.2);
    };

    drawHeader();
    for (const item of po.items) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        drawHeader();
      }
      drawRow(
        [
          item.itemName,
          `${item.quantity} ${item.unit ?? ''}`.trim(),
          money(item.rate),
          money(item.amount),
          money(item.cgst + item.sgst + item.igst + item.cess),
          String(item.receivedQty),
          String(item.pendingQty),
        ],
        false
      );
    }

    doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).text(`Tax: ${money(po.taxAmount)}`, left, doc.y, {
      width: fullWidth,
      align: 'right',
    });
    doc.font('Helvetica-Bold').fontSize(11).text(`Total: ${money(po.totalAmount)}`, left, doc.y + 4, {
      width: fullWidth,
      align: 'right',
    });

    doc.end();
  });
}
