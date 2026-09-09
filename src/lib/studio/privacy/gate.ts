/**
 * Effective privacy status for the approval gate — the ONE definition shared
 * by the server action (approveContent) and the UI (WorkflowBar/ApproveDialog),
 * so both sides always agree on whether an override is needed.
 *
 * Rule: worst of (latest check of any kind, latest AI/human verdict). A
 * deterministic re-scan can add new findings but can never erase a stricter
 * AI/human judgement — that needs a fresh AI check or an explicit override.
 */
import type { PrivacyStatus } from "@/lib/studio/types";

export interface PrivacyCheckLike {
  status: PrivacyStatus | string;
  checked_by: "deterministic" | "ai" | "human" | string;
  created_at: string;
}

const RANK: Record<PrivacyStatus, number> = { safe: 0, review_required: 1, blocked: 2 };

export function worstPrivacy(a: PrivacyStatus, b: PrivacyStatus): PrivacyStatus {
  return RANK[a] >= RANK[b] ? a : b;
}

function asStatus(s: string): PrivacyStatus {
  return s === "blocked" || s === "review_required" ? s : "safe";
}

export interface EffectivePrivacy {
  status: PrivacyStatus | null;
  /** Latest row regardless of kind (what the panel shows as "last check"). */
  latest: PrivacyCheckLike | null;
  /** Latest AI/human verdict, if any. */
  verdict: PrivacyCheckLike | null;
  /** True when the AI/human verdict is stricter than the latest scan and is what governs. */
  verdictGoverns: boolean;
}

/** `checks` must be ordered newest first (as loaded by the editor). */
export function effectivePrivacy(checks: PrivacyCheckLike[]): EffectivePrivacy {
  if (!checks.length) return { status: null, latest: null, verdict: null, verdictGoverns: false };
  const latest = checks[0];
  const verdict = checks.find((c) => c.checked_by === "ai" || c.checked_by === "human") ?? null;
  const latestStatus = asStatus(latest.status);
  if (!verdict) return { status: latestStatus, latest, verdict: null, verdictGoverns: false };
  const status = worstPrivacy(latestStatus, asStatus(verdict.status));
  return { status, latest, verdict, verdictGoverns: RANK[asStatus(verdict.status)] > RANK[latestStatus] };
}
