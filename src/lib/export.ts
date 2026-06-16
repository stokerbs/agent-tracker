import type { Report, Invoice, Client } from "@/lib/types";

interface ExportCaseRef {
  case_number?: string | null;
  client_name?: string | null;
  target_name?: string | null;
  case_type?: string | null;
}

interface ExportData {
  report: Report;
  caseRecord?: ExportCaseRef | null;
}

/** Generates and downloads a professional PDF using jsPDF (client-side). */
export async function exportReportPdf({ report, caseRecord }: ExportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth();
  let y = margin;

  const addHeading = (text: string, size = 13) => {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += size + 6;
  };

  const addBody = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(text || "—", width - margin * 2);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 15;
    }
    y += 8;
  };

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CONFIDENTIAL SURVEILLANCE REPORT", margin, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    [
      `Case: ${caseRecord?.case_number ?? "—"}`,
      `Client: ${caseRecord?.client_name ?? "—"}`,
      `Subject: ${caseRecord?.target_name ?? "—"}`,
      `Generated: ${new Date().toLocaleString()}`,
    ].join("    |    "),
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 26;
  doc.setDrawColor(200);
  doc.line(margin, y, width - margin, y);
  y += 24;

  addHeading("1. Executive Summary");
  addBody(report.executive_summary ?? "");
  addHeading("2. Chronological Surveillance Report");
  addBody(
    report.body?.split("2. CHRONOLOGICAL SURVEILLANCE REPORT")[1]?.split("3. OBSERVATIONS")[0]?.trim() ??
      "",
  );
  addHeading("3. Observations");
  addBody(report.observations ?? "");
  addHeading("4. Conclusion");
  addBody(report.conclusion ?? "");

  doc.save(`${caseRecord?.case_number ?? "report"}-surveillance-report.pdf`);
}

/** Generates and downloads a DOCX using the docx library (client-side). */
export async function exportReportDocx({ report, caseRecord }: ExportData) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");

  const section = (title: string, content: string) => [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }),
    ...content.split("\n").map(
      (line) =>
        new Paragraph({ children: [new TextRun(line)], spacing: { after: 80 } }),
    ),
  ];

  const chrono =
    report.body?.split("2. CHRONOLOGICAL SURVEILLANCE REPORT")[1]?.split("3. OBSERVATIONS")[0]?.trim() ?? "";

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "CONFIDENTIAL SURVEILLANCE REPORT",
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Case ${caseRecord?.case_number ?? "—"} · Client ${caseRecord?.client_name ?? "—"} · Subject ${caseRecord?.target_name ?? "—"}`,
                italics: true,
                color: "666666",
              }),
            ],
            spacing: { after: 240 },
          }),
          ...section("1. Executive Summary", report.executive_summary ?? ""),
          ...section("2. Chronological Surveillance Report", chrono),
          ...section("3. Observations", report.observations ?? ""),
          ...section("4. Conclusion", report.conclusion ?? ""),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${caseRecord?.case_number ?? "report"}-surveillance-report.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generates and downloads a professional invoice PDF using jsPDF (client-side). */
export async function exportInvoicePdf({
  invoice,
  client,
}: {
  invoice: Invoice;
  client?: Client | null;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageW = doc.internal.pageSize.getWidth();
  let y = margin;

  const line = (color = "#E2E8F0") => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor("#0EA5E9");
  doc.text("Detective Pulse", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#94A3B8");
  doc.text("Operations Command Center · Confidential", margin, y + 14);

  // Invoice number top-right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor("#0F172A");
  doc.text(invoice.invoice_number, pageW - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#64748B");
  doc.text(`Status: ${invoice.status.toUpperCase()}`, pageW - margin, y + 14, { align: "right" });
  y += 36;

  line();

  // Client + dates
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor("#0F172A");
  doc.text("Bill To", margin, y);
  doc.text("Date", pageW / 2, y);
  doc.text("Due Date", pageW - margin, y, { align: "right" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#334155");
  doc.text(client?.name ?? "—", margin, y);
  if (client?.company) { doc.setFontSize(9); doc.setTextColor("#64748B"); doc.text(client.company, margin, y + 11); }
  doc.setFontSize(10);
  doc.setTextColor("#334155");
  doc.text(invoice.issued_date, pageW / 2, y);
  doc.text(invoice.due_date ?? "—", pageW - margin, y, { align: "right" });
  y += 32;

  line();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor("#0F172A");
  doc.text(invoice.title, margin, y);
  y += 20;

  // Line items header
  doc.setFillColor("#F1F5F9");
  doc.rect(margin, y - 10, pageW - margin * 2, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor("#475569");
  doc.text("DESCRIPTION", margin + 4, y + 1);
  doc.text("QTY", pageW - margin - 160, y + 1);
  doc.text("UNIT PRICE", pageW - margin - 90, y + 1);
  doc.text("TOTAL", pageW - margin, y + 1, { align: "right" });
  y += 18;

  // Line items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#1E293B");
  for (const item of invoice.line_items) {
    doc.text(item.description || "—", margin + 4, y);
    doc.text(String(item.quantity), pageW - margin - 160, y);
    doc.text(item.unit_price.toLocaleString(), pageW - margin - 90, y);
    doc.text(item.total.toLocaleString(), pageW - margin, y, { align: "right" });
    y += 16;
    doc.setDrawColor("#F1F5F9");
    doc.setLineWidth(0.3);
    doc.line(margin, y - 4, pageW - margin, y - 4);
  }

  y += 8;
  line();

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor("#0EA5E9");
  doc.text("TOTAL", pageW - margin - 90, y);
  doc.text(
    `${invoice.amount.toLocaleString()} ${invoice.currency}`,
    pageW - margin,
    y,
    { align: "right" },
  );
  y += 24;

  // Notes
  if (invoice.notes) {
    line();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#64748B");
    const noteLines = doc.splitTextToSize(invoice.notes, pageW - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 12 + 8;
  }

  // Payment record
  if (invoice.status === "paid" && (invoice.paid_at || invoice.payment_method)) {
    line();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor("#10B981");
    doc.text("PAYMENT RECEIVED", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#334155");
    const payParts: string[] = [];
    if (invoice.paid_at) {
      payParts.push(
        new Date(invoice.paid_at).toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric",
        }),
      );
    }
    if (invoice.payment_method) {
      const labels: Record<string, string> = {
        bank_transfer: "Bank Transfer", cash: "Cash",
        credit_card: "Credit Card", cheque: "Cheque", other: "Other",
      };
      payParts.push(labels[invoice.payment_method] ?? invoice.payment_method);
    }
    if (invoice.payment_ref) payParts.push(`Ref: ${invoice.payment_ref}`);
    doc.text(payParts.join("  ·  "), margin, y + 12);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
