import "server-only";

import { privacyStatusFromFindings, scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { PrivacyFinding, PrivacyStatus } from "@/lib/studio/types";
import { brandSystemPrompt } from "../prompts/brand";
import { privacySystemAddendum, privacyUserPrompt } from "../prompts/privacy";
import { PrivacyReviewResponseSchema } from "../prompts/schemas";
import { runStructured } from "../run";

export interface PrivacyCheckResult {
  status: PrivacyStatus;
  findings: PrivacyFinding[];
  summary: string;
  suggestions: string[];
  checked_by: "deterministic" | "ai";
  model: string | null;
  /** Set when the AI pass was requested but failed — deterministic result still returned. */
  ai_error?: string;
}

const RANK: Record<PrivacyStatus, number> = { safe: 0, review_required: 1, blocked: 2 };
function worst(a: PrivacyStatus, b: PrivacyStatus): PrivacyStatus {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Content Safety / Privacy Check.
 * 1. Deterministic scrub ALWAYS runs (offline, instant).
 * 2. Optional AI review adds semantic findings (names, places, story specifics).
 * The final status is the WORST of both — the AI can only tighten, never loosen.
 */
export async function runPrivacyCheck(input: {
  fields: Record<string, string | null | undefined>;
  useAi: boolean;
  userId: string | null;
  /** For the generation log only. */
  masterId?: string | null;
}): Promise<PrivacyCheckResult> {
  // Fail closed: a settings outage must not run the gate with an empty denylist.
  const settings = await getStudioSettingsStrict();
  const rules = settings.privacy_rules;
  const det = scrubText({ fields: input.fields, rules });
  const detStatus = privacyStatusFromFindings(det, rules.strict_mode);

  if (!input.useAi) {
    return { status: detStatus, findings: det, summary: summarize(detStatus, det.length), suggestions: [], checked_by: "deterministic", model: null };
  }

  const res = await runStructured({
    purpose: "privacy_check",
    schema: PrivacyReviewResponseSchema,
    system: `${brandSystemPrompt(settings.brand_voice)}\n\n${privacySystemAddendum()}`,
    user: privacyUserPrompt({ fields: input.fields, deterministicFindings: det, denylist: rules.denylist }),
    inputRefs: { master_id: input.masterId ?? null, deterministic_findings: det.length, fields: Object.keys(input.fields) },
    userId: input.userId,
    effort: "medium",
    maxTokens: 4000,
  });

  if (!res.ok) {
    return {
      status: detStatus,
      findings: det,
      summary: summarize(detStatus, det.length),
      suggestions: [],
      checked_by: "deterministic",
      model: null,
      ai_error: res.error,
    };
  }

  const aiFindings: PrivacyFinding[] = res.data.findings.map((f) => ({
    kind: f.kind,
    excerpt: f.excerpt.slice(0, 80),
    reason: f.reason,
    severity: f.severity,
    field: f.field ?? undefined,
    source: "ai",
  }));
  const merged = [...det, ...aiFindings.filter((f) => !det.some((d) => d.excerpt === f.excerpt && d.kind === f.kind))];
  const status = worst(detStatus, res.data.status);
  return {
    status,
    findings: merged,
    summary: res.data.summary,
    suggestions: res.data.generalisation_suggestions,
    checked_by: "ai",
    model: res.model,
  };
}

function summarize(status: PrivacyStatus, n: number): string {
  if (status === "safe") return "ไม่พบข้อมูลระบุตัวตนจากการสแกนอัตโนมัติ";
  if (status === "blocked") return `พบข้อมูลที่ต้องเอาออกก่อนอนุมัติ (${n} จุด) — สร้างข้อความให้ทั่วไปขึ้นแทน อย่าแทนด้วยรายละเอียดสมมติ`;
  return `พบจุดที่ควรตรวจสอบ (${n} จุด) — เจ้าของต้องตัดสินใจก่อนอนุมัติ`;
}
