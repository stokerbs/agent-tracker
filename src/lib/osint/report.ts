/**
 * AI analyst report for an image analysis.
 *
 * Sends the *derived forensic facts* (plus a small thumbnail for visual
 * grounding) to Claude with forced tool use, so we always get structured JSON:
 * summary, likely origin, investigative leads, OSINT recommendations, and
 * risk/confidence scores. Facts-only — the model must reason from what we hand
 * it, never invent EXIF or coordinates.
 *
 * Per project rule (AI reports include map links): when GPS is present we
 * pre-build the Google Maps URL and pass it in, instructing the model to reuse
 * it verbatim rather than constructing its own.
 */

import sharp from "sharp";
import { getAiPromptText } from "@/lib/ai-prompts";
import type { AiReport, Attribution, ImageHashes, ImageMetadata, Integrity, RedirectHop } from "./types";

const AI_MODEL = process.env.OSINT_AI_MODEL ?? process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";
const TOOL_NAME = "write_image_report";

const DEFAULT_PROMPT = `You are a senior OSINT and digital-forensics analyst for a licensed private
investigation firm. You are given the DERIVED FORENSIC FACTS of a single image
(hashes, EXIF, GPS, redirect chain, cloud/CDN attribution, integrity heuristics).

Rules:
- Reason ONLY from the facts provided. Never invent EXIF fields, coordinates,
  camera models, or hosts that are not present.
- If a Google Maps link is provided for GPS coordinates, reference it verbatim.
- Be precise and investigative. Prefer concrete, actionable leads over generic advice.
- Write free-text output in Thai by default; keep technical tokens (hashes,
  hostnames, URLs, coordinates) exactly as given.
- Assign risk_score (0-100) for how sensitive/actionable this image is to an
  investigation, and confidence (0-100) for how well-supported your conclusions
  are by the available facts.`;

const REPORT_TOOL = {
  name: TOOL_NAME,
  description: "Return the structured OSINT image intelligence report.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-4 sentence forensic summary." },
      likely_origin: { type: "string", description: "Best-supported hypothesis for where the image came from." },
      leads: { type: "array", items: { type: "string" }, description: "Concrete investigative leads." },
      recommendations: { type: "array", items: { type: "string" }, description: "Next OSINT steps." },
      risk_score: { type: "integer", minimum: 0, maximum: 100 },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
    },
    required: ["summary", "likely_origin", "leads", "recommendations", "risk_score", "confidence"],
  },
} as const;

export interface ReportInput {
  metadata: ImageMetadata;
  hashes: ImageHashes;
  attribution: Attribution | null;
  redirects: RedirectHop[];
  integrity: Integrity;
  finalImageUrl: string | null;
}

/** Build the human-readable fact sheet handed to the model. */
export function buildFactSheet(input: ReportInput): string {
  const { metadata: m, hashes: h, attribution: a, redirects, integrity: intg } = input;
  const lines: string[] = [];

  lines.push("== IMAGE ==");
  lines.push(`dimensions: ${m.width ?? "?"}x${m.height ?? "?"}  format: ${m.format ?? "?"}  size: ${m.filesize ?? "?"} bytes`);
  lines.push(`sha256: ${h.sha256}`);
  lines.push(`phash: ${h.phash}  dhash: ${h.dhash}  ahash: ${h.ahash}`);

  lines.push("\n== EXIF ==");
  lines.push(`camera: ${[m.cameraMake, m.cameraModel].filter(Boolean).join(" ") || "none"}`);
  lines.push(`lens: ${m.lens ?? "none"}  software: ${m.software ?? "none"}  orientation: ${m.orientation ?? "?"}`);
  lines.push(`taken_at: ${m.takenAt ?? "unknown"}`);
  if (m.gpsLat != null && m.gpsLng != null) {
    lines.push(`gps: ${m.gpsLat}, ${m.gpsLng}`);
    lines.push(`gps_maps_url: ${googleMapsUrl(m.gpsLat, m.gpsLng)}`);
  } else {
    lines.push("gps: none");
  }

  lines.push("\n== INTEGRITY (heuristic) ==");
  lines.push(`metadata_stripped: ${intg.metadataStripped}  likely_resized: ${intg.likelyResized}  likely_screenshot: ${intg.likelyScreenshot}`);
  lines.push(`edited_software: ${intg.likelyEditedSoftware ?? "none"}  confidence: ${intg.confidence}`);
  if (intg.signals.length) lines.push(`signals: ${intg.signals.map((s) => s.key).join(", ")}`);

  lines.push("\n== ATTRIBUTION ==");
  lines.push(`host: ${a?.host ?? "unknown"}`);
  lines.push(`cloud: ${a?.cloud.map((c) => c.provider).join(", ") || "none"}`);
  lines.push(`cdn: ${a?.cdn.map((c) => c.provider).join(", ") || "none"}`);

  lines.push("\n== REDIRECT CHAIN ==");
  if (redirects.length) {
    for (const hop of redirects) {
      lines.push(`  [${hop.hopIndex}] ${hop.kind} ${hop.statusCode ?? ""} ${hop.url} (${hop.resolvedHost ?? "?"})`);
    }
  } else {
    lines.push("  none");
  }

  lines.push(`\nfinal_image_url: ${input.finalImageUrl ?? "n/a (uploaded / base64)"}`);
  return lines.join("\n");
}

/** Deterministically pre-build the Google Maps URL (model must not invent one). */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Make a small JPEG thumbnail (base64) for visual grounding; null on failure. */
async function thumbnail(buf: Buffer): Promise<string | null> {
  try {
    const out = await sharp(buf).resize(512, 512, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
    return out.toString("base64");
  } catch {
    return null;
  }
}

/**
 * Generate the AI report. Throws on transport/API failure so the pipeline marks
 * the report stage failed (and can be retried) without losing the forensic data.
 */
export async function generateReport(input: ReportInput, imageBuffer: Buffer): Promise<AiReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const system = await getAiPromptText("osint_image_report", DEFAULT_PROMPT);
  const facts = buildFactSheet(input);
  const thumb = await thumbnail(imageBuffer);

  const content: unknown[] = [{ type: "text", text: `DERIVED FORENSIC FACTS:\n\n${facts}` }];
  if (thumb) {
    content.push({ type: "text", text: "Thumbnail of the image (for visual grounding only):" });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: thumb } });
  }
  content.push({ type: "text", text: `Write the report using the ${TOOL_NAME} tool.` });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 2048,
      system,
      tools: [REPORT_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const toolUse = (data?.content ?? []).find(
    (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse?.input) throw new Error("AI did not return a structured report");

  return normalizeReport(toolUse.input as Partial<AiReport>);
}

function clampScore(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((s) => s.trim().length > 0);
}

export function normalizeReport(raw: Partial<AiReport>): AiReport {
  return {
    model: AI_MODEL,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    likelyOrigin: typeof raw.likelyOrigin === "string" ? raw.likelyOrigin : (raw as Record<string, unknown>).likely_origin as string ?? "",
    leads: stringArray(raw.leads),
    recommendations: stringArray(raw.recommendations),
    riskScore: clampScore((raw as Record<string, unknown>).risk_score ?? raw.riskScore),
    confidence: clampScore(raw.confidence),
  };
}
