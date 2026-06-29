import type { Invoice, Client, ExpenseCategory } from "@/lib/types";
import { INVOICE_REMIT, INVOICE_FOOTER_NOTE } from "@/lib/invoice-config";

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  notes: string | null;
  agents?: { full_name: string } | null;
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
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // No company name/branding anywhere on the invoice — operational security:
  // a surveillance subject must not be able to trace the firm from an invoice.
  const NAVY = "#21394A";
  const INK = "#1F2933";
  const MUTED = "#6B7785";
  const left = 64;
  const right = pageW - 64;
  const money = (n: number) => `${n.toLocaleString()} ${invoice.currency}`;

  // Outer navy frame
  doc.setDrawColor(NAVY);
  doc.setLineWidth(9);
  doc.rect(18, 18, pageW - 36, pageH - 36, "S");

  // Big "INVOICE" heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(NAVY);
  doc.text("INVOICE", left, 150);

  // ── Header blocks: "Invoice to" (left) + invoice number (right) ──
  const blockY = 188;
  const blockH = 74;
  const leftW = 236;
  const rightW = 219;
  const rightX = right - rightW;

  doc.setFillColor(NAVY);
  doc.rect(left, blockY, leftW, blockH, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Invoice to", left + 14, blockY + 20);
  doc.setFontSize(11);
  doc.text(client?.name ?? client?.company ?? "—", left + 14, blockY + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const addrLines: string[] = client?.address
    ? doc.splitTextToSize(client.address, leftW - 28)
    : client?.company
      ? [client.company]
      : [];
  let ay = blockY + 52;
  for (const ln of addrLines.slice(0, 2)) { doc.text(ln, left + 14, ay); ay += 11; }

  doc.setFillColor(NAVY);
  doc.rect(rightX, blockY, rightW, blockH, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Invoice #${invoice.invoice_number}`, rightX + rightW - 14, blockY + 28, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.issued_date, rightX + rightW - 14, blockY + 46, { align: "right" });
  if (invoice.due_date) {
    doc.text(`Due: ${invoice.due_date}`, rightX + rightW - 14, blockY + 60, { align: "right" });
  }

  // ── Items table ──
  let y = blockY + blockH + 56;
  const priceRight = right - 150;

  doc.setTextColor(NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Description", left, y);
  doc.text("Price", priceRight, y, { align: "right" });
  doc.text("Total", right, y, { align: "right" });
  y += 10;
  doc.setDrawColor(NAVY);
  doc.setLineWidth(1);
  doc.line(left, y, right, y);
  y += 24;

  doc.setFontSize(10);
  doc.setTextColor(INK);
  for (const item of invoice.line_items) {
    const label =
      item.quantity && item.quantity > 1
        ? `${item.description || "—"} (x${item.quantity})`
        : item.description || "—";
    const descLines: string[] = doc.splitTextToSize(label, priceRight - left - 16);
    doc.setFont("helvetica", "bold");
    doc.text(descLines, left, y);
    doc.setFont("helvetica", "normal");
    doc.text(money(item.unit_price), priceRight, y, { align: "right" });
    doc.text(money(item.total), right, y, { align: "right" });
    y += Math.max(descLines.length * 13, 18) + 6;
  }

  // Closing note (left) + Total box (right)
  y += 12;
  doc.setDrawColor("#CBD5E1");
  doc.setLineWidth(0.6);
  doc.line(left, y, priceRight - 10, y);
  y += 24;

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(INVOICE_FOOTER_NOTE, left, y + 4);

  const tbW = 290;
  const tbX = right - tbW;
  const tbY = y - 16;
  const tbH = 44;
  doc.setFillColor(NAVY);
  doc.rect(tbX, tbY, tbW, tbH, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", tbX + 18, tbY + tbH / 2 + 4);
  doc.setFontSize(13);
  doc.text(money(invoice.amount), right - 16, tbY + tbH / 2 + 4, { align: "right" });

  y = tbY + tbH + 28;

  // Optional free-text notes
  if (invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    const noteLines: string[] = doc.splitTextToSize(invoice.notes, right - left);
    doc.text(noteLines, left, y);
    y += noteLines.length * 12 + 10;
  }

  // Paid stamp
  if (invoice.status === "paid") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor("#0F8A4F");
    doc.text("PAID", left, y);
  }

  // ── Bank transfer details (bottom) ──
  const bankY = pageH - 150;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text(INVOICE_REMIT.bankLabel, left, bankY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#334155");
  doc.text(`Account Name: ${INVOICE_REMIT.accountName}`, left, bankY + 16);
  doc.text(`SWIFT Code : ${INVOICE_REMIT.swift}`, left, bankY + 31);
  doc.text(`Account Number: ${INVOICE_REMIT.accountNumber}`, left, bankY + 46);

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

  // Header — no company branding (operational security). The report title
  // stands alone; "Confidential" marks the internal document.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor("#21394A");
  doc.text(title, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#94A3B8");
  doc.text("Confidential", margin, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#64748B");
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, y, { align: "right" });
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
