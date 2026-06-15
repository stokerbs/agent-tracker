import type { AiReportSections, Case, TimelineEntry } from "@/lib/types";
import {
  buildSecureReportPrompt,
  PromptInjectionError,
  sanitizeTemplateData,
  validateReportOutput,
} from "@/lib/security/prompt-injection";
import { decryptField } from "@/lib/security/encryption";

interface GenerateInput {
  caseRecord: Case;
  entries: TimelineEntry[];
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
): Promise<AiReportSections> {
  const ordered = [...input.entries].sort((a, b) =>
    `${a.entry_date}T${a.entry_time}`.localeCompare(
      `${b.entry_date}T${b.entry_time}`,
    ),
  );

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await generateWithAnthropic(input.caseRecord, ordered);
    } catch (err) {
      if (err instanceof PromptInjectionError) throw err;
      console.error("AI report generation failed, using fallback:", err);
    }
  }
  return templateReport(input.caseRecord, ordered);
}

async function generateWithAnthropic(
  caseRecord: Case,
  entries: TimelineEntry[],
): Promise<AiReportSections> {
  const model = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";
  const targetName = caseRecord.target_name_enc
    ? decryptField(caseRecord.target_name_enc)
    : null;
  const { system, user } = buildSecureReportPrompt(caseRecord, entries, targetName);

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

// ----------------------------------------------------------------------------
// Deterministic fallback — produces a clean, professional report offline.
// Not subject to prompt injection since no LLM is involved.
// ----------------------------------------------------------------------------
function templateReport(
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

  const executive_summary = `This report documents surveillance conducted under case ${caseNumber}${
    clientName ? ` on behalf of ${clientName}` : ""
  }. Over the course of ${entries.length} logged observation${
    entries.length === 1 ? "" : "s"
  } ${period}, investigators monitored the movements and activities of ${subject}. ${
    locations.length
      ? `Observed activity spanned ${locations.length} distinct location${
          locations.length === 1 ? "" : "s"
        }, including ${locations.slice(0, 3).join(", ")}.`
      : "Location data was recorded where available."
  } The findings below present a factual, chronological account of all observed events.`;

  const chronological_report = entries.length
    ? entries
        .map(
          (e) =>
            `• ${e.entry_date} at ${e.entry_time} — ${sanitizeTemplateData(e.entry)}${
              e.location
                ? ` Location: ${sanitizeTemplateData(e.location)}.`
                : ""
            }`,
        )
        .join("\n")
    : "No timeline entries were recorded for this case during the reporting period.";

  const observations = entries.length
    ? `Investigators observed a consistent pattern of activity by ${subject}. ${
        locations.length > 1
          ? `Movement between ${locations[0]} and ${
              locations[locations.length - 1]
            } was noted, indicating an established routine.`
          : "Activity was concentrated in the monitored area."
      } No indication of counter-surveillance awareness was identified. All observations were made from a discreet vantage point without direct contact with the subject.`
    : `No substantive observations were recorded. Surveillance should be continued to establish a behavioural pattern for ${subject}.`;

  const conclusion = `Based on the surveillance conducted ${period}, the documented activities of ${subject} have been recorded objectively and in full. ${
    entries.length
      ? "The evidence gathered supports the chronological account presented in this report."
      : "Further observation is recommended to obtain conclusive findings."
  } This report has been prepared in accordance with professional investigative standards and may be relied upon for the purposes for which it was commissioned.`;

  return {
    executive_summary,
    chronological_report,
    observations,
    conclusion,
  };
}
