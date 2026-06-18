import type { AiReportSections, Case, ReportLanguage, TimelineEntry } from "@/lib/types";
import {
  buildSecureReportPrompt,
  PromptInjectionError,
  sanitizeTemplateData,
  validateReportOutput,
} from "@/lib/security/prompt-injection";
import { decryptField } from "@/lib/security/encryption";
import { getAiPromptText } from "@/lib/ai-prompts";
import type { ReportSource } from "@/lib/report-parser";

export type { ReportSource };

export interface GenerateResult {
  sections: AiReportSections;
  source: ReportSource;
}

interface GenerateInput {
  caseRecord: Case;
  entries: TimelineEntry[];
  language?: ReportLanguage;
}

/**
 * Generates a structured surveillance report from timeline entries.
 *
 * Uses the Anthropic API when ANTHROPIC_API_KEY is set; otherwise falls back
 * to a deterministic template engine so the feature works without external
 * dependencies (and remains fully testable offline).
 *
 * PromptInjectionError is re-thrown without fallback — a compromised AI
 * output should never be silently replaced by the template engine.
 */
export async function generateReport(
  input: GenerateInput,
): Promise<GenerateResult> {
  const language = input.language ?? "th";
  const ordered = [...input.entries].sort((a, b) =>
    `${a.entry_date}T${a.entry_time}`.localeCompare(
      `${b.entry_date}T${b.entry_time}`,
    ),
  );

  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key !== "your-anthropic-api-key") {
    try {
      const sections = await generateWithAnthropic(
        input.caseRecord,
        ordered,
        language,
      );
      return { sections, source: "claude" };
    } catch (err) {
      if (err instanceof PromptInjectionError) throw err;
      console.error("AI report generation failed, using fallback:", err);
    }
  }
  const sections =
    language === "th"
      ? thaiTemplateReport(input.caseRecord, ordered)
      : englishTemplateReport(input.caseRecord, ordered);
  return { sections, source: "template" };
}

async function generateWithAnthropic(
  caseRecord: Case,
  entries: TimelineEntry[],
  language: ReportLanguage,
): Promise<AiReportSections> {
  const model = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";
  const targetName = caseRecord.target_name_enc
    ? decryptField(caseRecord.target_name_enc)
    : null;

  // Load system prompt from DB; falls back to hardcoded default if missing.
  const promptKey = `surveillance_report_${language}`;
  const systemOverride = await getAiPromptText(promptKey, "");

  const { system, user } = buildSecureReportPrompt(
    caseRecord,
    entries,
    targetName,
    language,
    systemOverride || undefined,
  );

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  const sections: AiReportSections = {
    executive_summary: parsed.executive_summary ?? "",
    chronological_report: parsed.chronological_report ?? "",
    observations: parsed.observations ?? "",
    conclusion: parsed.conclusion ?? "",
  };

  validateReportOutput(sections);
  return sections;
}

// ─── Thai date helpers ────────────────────────────────────────────────────────

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const month = THAI_MONTHS[d.getMonth()];
  const year = d.getFullYear() + 543; // Buddhist Era
  return `${day} ${month} ${year}`;
}

function todayThaiDate(): string {
  const d = new Date();
  return formatThaiDate(d.toISOString().slice(0, 10));
}

// ─── Thai template report ────────────────────────────────────────────────────

function thaiTemplateReport(
  caseRecord: Case,
  entries: TimelineEntry[],
): AiReportSections {
  const targetName = caseRecord.target_name_enc
    ? decryptField(caseRecord.target_name_enc)
    : null;
  const subject = sanitizeTemplateData(targetName ?? "ผู้ต้องสงสัย");
  const clientName = caseRecord.client_name
    ? sanitizeTemplateData(caseRecord.client_name)
    : null;
  const caseNumber = sanitizeTemplateData(caseRecord.case_number);

  const dates = entries.map((e) => e.entry_date);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const locations = Array.from(
    new Set(
      entries
        .map((e) => (e.location ? sanitizeTemplateData(e.location) : null))
        .filter(Boolean),
    ),
  ) as string[];

  const period =
    firstDate && lastDate
      ? firstDate === lastDate
        ? `เมื่อวันที่ ${formatThaiDate(firstDate)}`
        : `ระหว่างวันที่ ${formatThaiDate(firstDate)} ถึง ${formatThaiDate(lastDate)}`
      : "ในช่วงระยะเวลาที่กำหนด";

  const executive_summary =
    `รายงานฉบับนี้บันทึกผลการปฏิบัติงานสอดแนมภายใต้คดีหมายเลข ${caseNumber}` +
    (clientName ? ` ว่าจ้างโดย ${clientName}` : "") +
    ` โดยเจ้าหน้าที่ได้ทำการสอดแนมติดตามความเคลื่อนไหวและกิจกรรมของ${subject} ${period}` +
    ` รวมการบันทึกการสังเกตการณ์ทั้งสิ้น ${entries.length} รายการ` +
    (locations.length
      ? ` ครอบคลุมพื้นที่ ${locations.length} แห่ง ได้แก่ ${locations.slice(0, 3).join(" ")}`
      : "") +
    " รายงานฉบับนี้นำเสนอข้อเท็จจริงตามลำดับเวลาของเหตุการณ์ที่พบเห็นอย่างครบถ้วน";

  const chronological_report = entries.length
    ? entries
        .map(
          (e) =>
            `• ${formatThaiDate(e.entry_date)} เวลา ${e.entry_time} น. — ${sanitizeTemplateData(e.entry)}` +
            (e.location ? ` สถานที่: ${sanitizeTemplateData(e.location)}` : ""),
        )
        .join("\n")
    : "ไม่มีรายการบันทึกการสอดแนมในช่วงระยะเวลาดังกล่าว";

  const observations = entries.length
    ? `จากการสอดแนมติดตาม${subject} พบรูปแบบการดำเนินชีวิตที่สม่ำเสมอ` +
      (locations.length > 1
        ? ` มีการเดินทางระหว่าง${locations[0]}และ${locations[locations.length - 1]} แสดงให้เห็นถึงกิจวัตรประจำวันที่แน่นอน`
        : " กิจกรรมส่วนใหญ่อยู่ในบริเวณพื้นที่ที่ทำการสอดแนม") +
      " ไม่พบสัญญาณการต่อต้านการสอดแนมแต่อย่างใด การสังเกตการณ์ทั้งหมดกระทำโดยไม่มีการติดต่อหรือรบกวนผู้ถูกสังเกตการณ์"
    : `ไม่สามารถบันทึกการสังเกตการณ์ที่เป็นสาระสำคัญได้ ควรดำเนินการสอดแนมเพิ่มเติมเพื่อกำหนดรูปแบบพฤติกรรมของ${subject}`;

  const conclusion =
    `จากผลการปฏิบัติงานสอดแนม${period} กิจกรรมของ${subject}ได้รับการบันทึกอย่างเป็นกลางและครบถ้วน` +
    (entries.length
      ? " หลักฐานที่รวบรวมได้สนับสนุนรายงานตามลำดับเวลาที่นำเสนอในเอกสารฉบับนี้"
      : " ขอแนะนำให้ดำเนินการสอดแนมเพิ่มเติมเพื่อให้ได้ข้อสรุปที่ชัดเจน") +
    " รายงานฉบับนี้จัดทำตามมาตรฐานวิชาชีพการสืบสวนและสามารถนำไปใช้อ้างอิงได้ตามวัตถุประสงค์ที่ได้รับมอบหมาย";

  return { executive_summary, chronological_report, observations, conclusion };
}

// ─── English template report (original) ─────────────────────────────────────

function englishTemplateReport(
  caseRecord: Case,
  entries: TimelineEntry[],
): AiReportSections {
  const targetName = caseRecord.target_name_enc
    ? decryptField(caseRecord.target_name_enc)
    : null;
  const subject = sanitizeTemplateData(
    targetName ?? "the subject of interest",
  );
  const clientName = caseRecord.client_name
    ? sanitizeTemplateData(caseRecord.client_name)
    : null;
  const caseNumber = sanitizeTemplateData(caseRecord.case_number);

  const dates = entries.map((e) => e.entry_date);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const locations = Array.from(
    new Set(
      entries
        .map((e) => (e.location ? sanitizeTemplateData(e.location) : null))
        .filter(Boolean),
    ),
  ) as string[];

  const period =
    firstDate && lastDate
      ? firstDate === lastDate
        ? `on ${firstDate}`
        : `between ${firstDate} and ${lastDate}`
      : "during the observation period";

  const executive_summary =
    `This report documents surveillance conducted under case ${caseNumber}` +
    (clientName ? ` on behalf of ${clientName}` : "") +
    `. Over the course of ${entries.length} logged observation${entries.length === 1 ? "" : "s"} ${period}, investigators monitored the movements and activities of ${subject}. ` +
    (locations.length
      ? `Observed activity spanned ${locations.length} distinct location${locations.length === 1 ? "" : "s"}, including ${locations.slice(0, 3).join(", ")}.`
      : "Location data was recorded where available.") +
    " The findings below present a factual, chronological account of all observed events.";

  const chronological_report = entries.length
    ? entries
        .map(
          (e) =>
            `• ${e.entry_date} at ${e.entry_time} — ${sanitizeTemplateData(e.entry)}` +
            (e.location ? ` Location: ${sanitizeTemplateData(e.location)}.` : ""),
        )
        .join("\n")
    : "No timeline entries were recorded for this case during the reporting period.";

  const observations = entries.length
    ? `Investigators observed a consistent pattern of activity by ${subject}. ` +
      (locations.length > 1
        ? `Movement between ${locations[0]} and ${locations[locations.length - 1]} was noted, indicating an established routine.`
        : "Activity was concentrated in the monitored area.") +
      " No indication of counter-surveillance awareness was identified. All observations were made from a discreet vantage point without direct contact with the subject."
    : `No substantive observations were recorded. Surveillance should be continued to establish a behavioural pattern for ${subject}.`;

  const conclusion =
    `Based on the surveillance conducted ${period}, the documented activities of ${subject} have been recorded objectively and in full. ` +
    (entries.length
      ? "The evidence gathered supports the chronological account presented in this report."
      : "Further observation is recommended to obtain conclusive findings.") +
    " This report has been prepared in accordance with professional investigative standards and may be relied upon for the purposes for which it was commissioned.";

  return { executive_summary, chronological_report, observations, conclusion };
}

export { todayThaiDate };
