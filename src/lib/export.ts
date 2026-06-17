import type { Report, Invoice, Client, ExpenseCategory } from "@/lib/types";
import { stripProviderTag } from "@/lib/report-parser";
import { htmlToPlainText, isHtmlContent } from "@/components/shared/rich-text-editor";

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  notes: string | null;
  agents?: { full_name: string } | null;
}

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

function isThaiBod(report: { body?: string | null }): boolean {
  return report.body?.includes("ลำดับเหตุการณ์") ?? false;
}

function extractChronoForExport(rawBody: string | null): string {
  if (!rawBody) return "";
  const body = stripProviderTag(rawBody);
  if (body.includes("ลำดับเหตุการณ์")) {
    const section = body.split("2. ลำดับเหตุการณ์")[1]?.split("\n3. ข้อสังเกต")[0]?.trim() ?? body;
    return isHtmlContent(section) ? htmlToPlainText(section) : section;
  }
  const section = body.split("2. CHRONOLOGICAL SURVEILLANCE REPORT")[1]?.split("3. OBSERVATIONS")[0]?.trim() ?? body;
  return isHtmlContent(section) ? htmlToPlainText(section) : section;
}

function toExportText(text: string | null | undefined): string {
  if (!text) return "";
  return isHtmlContent(text) ? htmlToPlainText(text) : text;
}

/** Generates and downloads a professional PDF using jsPDF (client-side). */
export async function exportReportPdf({ report, caseRecord }: ExportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth();
  let y = margin;
  const thai = isThaiBod(report);

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
  doc.text(
    thai ? "รายงานการสอดแนม (ลับ)" : "CONFIDENTIAL SURVEILLANCE REPORT",
    margin,
    y,
  );
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    [
      `${thai ? "คดี" : "Case"}: ${caseRecord?.case_number ?? "—"}`,
      `${thai ? "ลูกค้า" : "Client"}: ${caseRecord?.client_name ?? "—"}`,
      `${thai ? "เป้าหมาย" : "Subject"}: ${caseRecord?.target_name ?? "—"}`,
      `${thai ? "สร้างเมื่อ" : "Generated"}: ${new Date().toLocaleString()}`,
    ].join("    |    "),
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 26;
  doc.setDrawColor(200);
  doc.line(margin, y, width - margin, y);
  y += 24;

  if (thai) {
    addHeading("1. สรุปผลการปฏิบัติงาน");
    addBody(toExportText(report.executive_summary));
    addHeading("2. ลำดับเหตุการณ์");
    addBody(extractChronoForExport(report.body ?? null));
    addHeading("3. ข้อสังเกต");
    addBody(toExportText(report.observations));
    addHeading("4. สรุป");
    addBody(toExportText(report.conclusion));
  } else {
    addHeading("1. Executive Summary");
    addBody(toExportText(report.executive_summary));
    addHeading("2. Chronological Surveillance Report");
    addBody(extractChronoForExport(report.body ?? null));
    addHeading("3. Observations");
    addBody(toExportText(report.observations));
    addHeading("4. Conclusion");
    addBody(toExportText(report.conclusion));
  }

  doc.save(`${caseRecord?.case_number ?? "report"}-surveillance-report.pdf`);
}

/** Generates and downloads a DOCX using the docx library (client-side). */
export async function exportReportDocx({ report, caseRecord }: ExportData) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
  const thai = isThaiBod(report);

  const section = (title: string, content: string) => [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }),
    ...content.split("\n").map(
      (line) =>
        new Paragraph({ children: [new TextRun(line)], spacing: { after: 80 } }),
    ),
  ];

  const chrono = extractChronoForExport(report.body ?? null);

  const docTitle = thai ? "รายงานการสอดแนม (ลับ)" : "CONFIDENTIAL SURVEILLANCE REPORT";
  const metaText = thai
    ? `คดี ${caseRecord?.case_number ?? "—"} · ลูกค้า ${caseRecord?.client_name ?? "—"} · เป้าหมาย ${caseRecord?.target_name ?? "—"}`
    : `Case ${caseRecord?.case_number ?? "—"} · Client ${caseRecord?.client_name ?? "—"} · Subject ${caseRecord?.target_name ?? "—"}`;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: docTitle, heading: HeadingLevel.TITLE }),
          new Paragraph({
            children: [new TextRun({ text: metaText, italics: true, color: "666666" })],
            spacing: { after: 240 },
          }),
          ...(thai
            ? [
                ...section("1. สรุปผลการปฏิบัติงาน", toExportText(report.executive_summary)),
                ...section("2. ลำดับเหตุการณ์", chrono),
                ...section("3. ข้อสังเกต", toExportText(report.observations)),
                ...section("4. สรุป", toExportText(report.conclusion)),
              ]
            : [
                ...section("1. Executive Summary", toExportText(report.executive_summary)),
                ...section("2. Chronological Surveillance Report", chrono),
                ...section("3. Observations", toExportText(report.observations)),
                ...section("4. Conclusion", toExportText(report.conclusion)),
              ]),
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

const CATEGORY_LABELS: Record<string, string> = {
  fuel: "Fuel", toll: "Toll", parking: "Parking",
  food: "Food", hotel: "Hotel", misc: "Miscellaneous",
};

/** Generates and downloads a PDF expense report using jsPDF (client-side). */
export async function exportExpensesPdf({
  expenses,
  title = "Expense Report",
}: {
  expenses: ExpenseRow[];
  title?: string;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const rule = (color = "#E2E8F0") => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  };

  const checkPage = (need = 16) => {
    if (y + need > pageH - margin) { doc.addPage(); y = margin; }
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor("#0F172A");
  doc.text(title, pageW - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#64748B");
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, y + 14, { align: "right" });
  y += 36;

  rule();

  // Category summary
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const currency = expenses[0]?.currency ?? "THB";

  if (Object.keys(byCategory).length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor("#0F172A");
    doc.text("Summary by Category", margin, y);
    y += 14;

    for (const [cat, amt] of Object.entries(byCategory)) {
      checkPage(14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor("#334155");
      doc.text(CATEGORY_LABELS[cat] ?? cat, margin + 4, y);
      doc.text(`${Number(amt).toLocaleString()} ${currency}`, pageW - margin, y, { align: "right" });
      y += 14;
    }

    y += 4;
    rule();
  }

  // Itemized table header
  doc.setFillColor("#F1F5F9");
  doc.rect(margin, y - 10, pageW - margin * 2, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor("#475569");
  const cols = { date: margin + 4, agent: margin + 70, cat: margin + 200, notes: margin + 270, amt: pageW - margin };
  doc.text("DATE", cols.date, y + 1);
  doc.text("AGENT", cols.agent, y + 1);
  doc.text("CATEGORY", cols.cat, y + 1);
  doc.text("NOTES", cols.notes, y + 1);
  doc.text("AMOUNT", cols.amt, y + 1, { align: "right" });
  y += 18;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#1E293B");

  for (const e of expenses) {
    checkPage(14);
    const dateStr = new Date(e.expense_date).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
    const agentName = e.agents?.full_name ?? "—";
    const catLabel = CATEGORY_LABELS[e.category] ?? e.category;
    const notes = e.notes ? (e.notes.length > 30 ? e.notes.slice(0, 28) + "…" : e.notes) : "—";
    const amtStr = `${Number(e.amount).toLocaleString()} ${e.currency}`;

    doc.text(dateStr, cols.date, y);
    doc.text(agentName.length > 16 ? agentName.slice(0, 14) + "…" : agentName, cols.agent, y);
    doc.text(catLabel, cols.cat, y);
    doc.text(notes, cols.notes, y);
    doc.text(amtStr, cols.amt, y, { align: "right" });
    y += 14;

    doc.setDrawColor("#F1F5F9");
    doc.setLineWidth(0.3);
    doc.line(margin, y - 3, pageW - margin, y - 3);
  }

  y += 6;
  rule();

  // Grand total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor("#0EA5E9");
  doc.text("TOTAL", pageW - margin - 120, y);
  doc.text(`${total.toLocaleString()} ${currency}`, pageW - margin, y, { align: "right" });

  const slug = title.toLowerCase().replace(/\s+/g, "-");
  doc.save(`${slug}.pdf`);
}
