import type { Report } from "@/lib/types";

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
