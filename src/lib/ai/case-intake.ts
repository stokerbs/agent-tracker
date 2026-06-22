import { getAiPromptText } from "@/lib/ai-prompts";
import type { IntakeExtraction } from "@/lib/types";

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";
const TOOL_NAME = "extract_case_intake";

/**
 * Fallback prompt if the `case_intake` row is missing from ai_prompts.
 * Kept in sync with the seed in migration 0065.
 */
export const DEFAULT_INTAKE_PROMPT = `You are an intelligence extraction assistant for a Thai private investigation agency. You are given one or more uploaded files (documents, screenshots, photos) for a single case. Extract structured intelligence using the extract_case_intake tool.

ABSOLUTE RULES:
- Extract ONLY facts explicitly present in the files. Never assume, infer, speculate, profile, or predict.
- If a value is not stated, use null. Do not guess.
- Support both Thai and English content. Preserve names in their original script.
- Every extracted item must include a confidence integer 0-100 reflecting how clearly the file states it.
- Every item must list the source filenames it came from in source_files.

TIMELINE RULE (critical):
- Split every distinct timestamp into its OWN timeline entry. Never combine multiple timed events into one entry.
- Example: "10.15 left home / 11.20 arrived Starbucks / 13.45 returned home" -> THREE separate entries.
- Normalise times to 24-hour HH:MM. Normalise dates to YYYY-MM-DD when a date is present.

IMAGE CLASSIFICATION:
- Classify each uploaded image into exactly one kind: target_photo (a person who is the subject), vehicle_photo (a car/motorcycle), document (ID card, passport, licence, registration, contract), screenshot (chat/social/app capture), location (a place/building), or other.
- If a vehicle_photo clearly matches one of the extracted vehicles, set vehicle_index to that vehicle's position in the vehicles array (0-based).

Return everything through the tool. Do not write prose.`;

// Anthropic tool input_schema — drives strict structured output.
const INTAKE_TOOL = {
  name: TOOL_NAME,
  description:
    "Record the case intelligence extracted from the uploaded files. Only include facts explicitly present in the files.",
  input_schema: {
    type: "object",
    properties: {
      case: {
        type: "object",
        properties: {
          suggested_title: { type: ["string", "null"], description: "A short case title, only if derivable from explicit facts." },
          summary: { type: ["string", "null"], description: "A 1-2 sentence factual summary of what the files contain." },
          case_type: { type: ["string", "null"], description: "e.g. Infidelity, Insurance, Background check — only if stated." },
        },
        required: ["suggested_title", "summary", "case_type"],
      },
      targets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            full_name: { type: ["string", "null"] },
            nickname: { type: ["string", "null"] },
            gender: { type: ["string", "null"], enum: ["male", "female", "other", null] },
            dob: { type: ["string", "null"], description: "YYYY-MM-DD" },
            age: { type: ["integer", "null"] },
            nationality: { type: ["string", "null"] },
            occupation: { type: ["string", "null"] },
            phones: { type: "array", items: { type: "string" } },
            emails: { type: "array", items: { type: "string" } },
            socials: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: { type: ["string", "null"] },
                  handle: { type: ["string", "null"] },
                },
                required: ["platform", "handle"],
              },
            },
            notes: { type: ["string", "null"] },
            confidence: { type: "integer" },
            source_files: { type: "array", items: { type: "string" } },
          },
          required: ["full_name", "phones", "emails", "socials", "confidence", "source_files"],
        },
      },
      vehicles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            make: { type: ["string", "null"] },
            model: { type: ["string", "null"] },
            color: { type: ["string", "null"] },
            plate: { type: ["string", "null"] },
            is_primary: { type: "boolean" },
            confidence: { type: "integer" },
            source_files: { type: "array", items: { type: "string" } },
          },
          required: ["confidence", "source_files"],
        },
      },
      locations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["home", "workplace", "other"] },
            label: { type: ["string", "null"], description: "Name of the place when type is other (hotel, condo, restaurant…)." },
            address: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            confidence: { type: "integer" },
            source_files: { type: "array", items: { type: "string" } },
          },
          required: ["type", "confidence", "source_files"],
        },
      },
      relationships: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: ["string", "null"] },
            relation: { type: "string", enum: ["spouse", "partner", "friend", "associate", "family", "other"] },
            notes: { type: ["string", "null"] },
            confidence: { type: "integer" },
            source_files: { type: "array", items: { type: "string" } },
          },
          required: ["relation", "confidence", "source_files"],
        },
      },
      timeline: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: ["string", "null"], description: "YYYY-MM-DD" },
            time: { type: ["string", "null"], description: "24-hour HH:MM" },
            entry: { type: "string", description: "A single observed event." },
            location: { type: ["string", "null"] },
            confidence: { type: "integer" },
            source_files: { type: "array", items: { type: "string" } },
          },
          required: ["entry", "confidence", "source_files"],
        },
      },
      documents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            source_file: { type: "string" },
            doc_kind: { type: "string", enum: ["id_card", "passport", "drivers_license", "vehicle_reg", "contract", "other"] },
            summary: { type: ["string", "null"] },
            confidence: { type: "integer" },
          },
          required: ["source_file", "doc_kind", "confidence"],
        },
      },
      image_classifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            file: { type: "string" },
            kind: { type: "string", enum: ["target_photo", "vehicle_photo", "document", "screenshot", "location", "other"] },
            confidence: { type: "integer" },
            vehicle_index: { type: ["integer", "null"] },
          },
          required: ["file", "kind", "confidence"],
        },
      },
    },
    required: ["case", "targets", "vehicles", "locations", "relationships", "timeline", "documents", "image_classifications"],
  },
} as const;

export interface IntakeFilePart {
  name: string;
  mimeType: string;
  /** base64 data for image/pdf files */
  base64?: string;
  /** UTF-8 text for text/plain files */
  text?: string;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

function buildContent(files: IntakeFilePart[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const f of files) {
    // Label each file so the model can reference it by name in source_files.
    blocks.push({ type: "text", text: `FILE: ${f.name}` });
    if (f.mimeType === "application/pdf" && f.base64) {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } });
    } else if (f.mimeType.startsWith("image/") && f.base64) {
      blocks.push({ type: "image", source: { type: "base64", media_type: f.mimeType, data: f.base64 } });
    } else if (f.text != null) {
      blocks.push({ type: "text", text: `<<<CONTENT of ${f.name}>>>\n${f.text}` });
    }
  }
  blocks.push({
    type: "text",
    text: "Extract all case intelligence from the files above using the extract_case_intake tool. Facts only — no inference.",
  });
  return blocks;
}

/**
 * Sends the staged files to Claude and returns the structured extraction.
 * Uses forced tool use for reliable JSON. Throws on transport/API failure.
 */
export async function analyzeIntake(files: IntakeFilePart[]): Promise<IntakeExtraction> {
  const system = await getAiPromptText("case_intake", DEFAULT_INTAKE_PROMPT);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 8192,
      system,
      tools: [INTAKE_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: buildContent(files) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = await res.json();
  const toolUse = (data?.content ?? []).find(
    (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse?.input) {
    throw new Error("AI did not return structured extraction");
  }
  return normalizeExtraction(toolUse.input as Partial<IntakeExtraction>);
}

/** Fills in missing arrays/fields so the review UI can rely on a complete shape. */
function normalizeExtraction(raw: Partial<IntakeExtraction>): IntakeExtraction {
  return {
    case: {
      suggested_title: raw.case?.suggested_title ?? null,
      summary: raw.case?.summary ?? null,
      case_type: raw.case?.case_type ?? null,
    },
    targets: (raw.targets ?? []).map((t) => ({
      full_name: t.full_name ?? null,
      nickname: t.nickname ?? null,
      gender: t.gender ?? null,
      dob: t.dob ?? null,
      age: t.age ?? null,
      nationality: t.nationality ?? null,
      occupation: t.occupation ?? null,
      phones: t.phones ?? [],
      emails: t.emails ?? [],
      socials: t.socials ?? [],
      notes: t.notes ?? null,
      confidence: t.confidence ?? 0,
      source_files: t.source_files ?? [],
    })),
    vehicles: (raw.vehicles ?? []).map((v) => ({
      make: v.make ?? null,
      model: v.model ?? null,
      color: v.color ?? null,
      plate: v.plate ?? null,
      is_primary: v.is_primary ?? false,
      confidence: v.confidence ?? 0,
      source_files: v.source_files ?? [],
    })),
    locations: (raw.locations ?? []).map((l) => ({
      type: l.type ?? "other",
      label: l.label ?? null,
      address: l.address ?? null,
      notes: l.notes ?? null,
      confidence: l.confidence ?? 0,
      source_files: l.source_files ?? [],
    })),
    relationships: (raw.relationships ?? []).map((r) => ({
      name: r.name ?? null,
      relation: r.relation ?? "associate",
      notes: r.notes ?? null,
      confidence: r.confidence ?? 0,
      source_files: r.source_files ?? [],
    })),
    timeline: (raw.timeline ?? []).map((e) => ({
      date: e.date ?? null,
      time: e.time ?? null,
      entry: e.entry ?? "",
      location: e.location ?? null,
      confidence: e.confidence ?? 0,
      source_files: e.source_files ?? [],
    })),
    documents: (raw.documents ?? []).map((d) => ({
      source_file: d.source_file ?? "",
      doc_kind: d.doc_kind ?? "other",
      summary: d.summary ?? null,
      confidence: d.confidence ?? 0,
    })),
    image_classifications: (raw.image_classifications ?? []).map((c) => ({
      file: c.file ?? "",
      kind: c.kind ?? "other",
      confidence: c.confidence ?? 0,
      vehicle_index: c.vehicle_index ?? null,
    })),
  };
}
