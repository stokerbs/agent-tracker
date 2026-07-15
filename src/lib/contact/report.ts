/**
 * AI analyst report for a contact lookup. Same forced-tool-use pattern as the
 * image module's report.ts — reasons only from the facts we pass it.
 */

import { getAiPromptText } from "@/lib/ai-prompts";
import type { ContactInputType, ContactReport, PhoneInfo } from "./types";

const AI_MODEL = process.env.OSINT_AI_MODEL ?? process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";
const TOOL_NAME = "write_contact_report";

const DEFAULT_PROMPT = `You are a senior OSINT analyst for a licensed private investigation firm.
You are given the DERIVED FACTS about a target contact identifier (a phone number,
email, or username). Reason ONLY from the facts provided — never invent carriers,
owners, or accounts that are not present.

Give: a short summary, concrete investigative leads (where to look next), OSINT
recommendations, a risk_score (0-100, how actionable/sensitive this identifier is)
and confidence (0-100). Write free text in Thai by default; keep technical tokens
(numbers, emails, usernames) exactly as given.`;

const REPORT_TOOL = {
  name: TOOL_NAME,
  description: "Return the structured contact intelligence report.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      leads: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      risk_score: { type: "integer", minimum: 0, maximum: 100 },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
    },
    required: ["summary", "leads", "recommendations", "risk_score", "confidence"],
  },
} as const;

export interface ContactReportInput {
  inputType: ContactInputType;
  inputDisplay: string;
  phone: PhoneInfo | null;
}

export function buildContactFactSheet(input: ContactReportInput): string {
  const lines: string[] = [];
  lines.push(`== TARGET IDENTIFIER ==`);
  lines.push(`type: ${input.inputType}`);
  lines.push(`value: ${input.inputDisplay}`);
  if (input.phone) {
    const p = input.phone;
    lines.push(`\n== PHONE ==`);
    lines.push(`valid: ${p.valid}  possible: ${p.possible}`);
    lines.push(`e164: ${p.e164 ?? "n/a"}  national: ${p.national ?? "n/a"}`);
    lines.push(`country: ${p.country ?? "?"}  calling_code: ${p.countryCallingCode ?? "?"}`);
    lines.push(`line_type: ${p.lineType ?? "unknown"}`);
  }
  return lines.join("\n");
}

/** Generate the AI report. Throws on API failure (pipeline marks the stage failed). */
export async function generateContactReport(input: ContactReportInput): Promise<ContactReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const system = await getAiPromptText("osint_contact_report", DEFAULT_PROMPT);
  const facts = buildContactFactSheet(input);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1536,
      system,
      tools: [REPORT_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: `DERIVED FACTS:\n\n${facts}\n\nWrite the report using the ${TOOL_NAME} tool.` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const toolUse = (data?.content ?? []).find(
    (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse?.input) throw new Error("AI did not return a structured report");
  return normalizeContactReport(toolUse.input as Record<string, unknown>);
}

function clamp(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter((s) => s.trim().length > 0) : [];
}

export function normalizeContactReport(raw: Record<string, unknown>): ContactReport {
  return {
    model: AI_MODEL,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    leads: arr(raw.leads),
    recommendations: arr(raw.recommendations),
    riskScore: clamp(raw.risk_score),
    confidence: clamp(raw.confidence),
  };
}
