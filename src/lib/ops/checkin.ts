// Per-case agent check-in cadence — pure state machine deciding, for one case,
// whether the assigned agents should be reminded to report or whether an overdue
// case should be escalated to supervisors. Kept free of I/O so it can be unit
// tested; the cron supplies the latest-report timestamp and persists the stage.

export type CheckinStage = "ok" | "reminded" | "escalated";
export type CheckinAction = "none" | "remind" | "escalate";

export const DEFAULT_GRACE_MIN = 15;

/**
 * Decide the next stage + action from how overdue a case is.
 *
 *   on track (< interval)            → ok / none
 *   overdue, within grace            → remind once (ok → reminded)
 *   overdue past interval + grace    → escalate once (→ escalated)
 *
 * When a fresh report lands, overdue drops below the interval and the stage
 * resets to "ok", so the next missed window re-arms reminders cleanly.
 */
export function evaluateCheckin(opts: {
  intervalMin: number;
  /** ISO of the latest timeline entry (or the case start as a seed). */
  lastReportAt: string | null;
  now?: Date;
  graceMin?: number;
  stage: CheckinStage;
}): { stage: CheckinStage; action: CheckinAction; overdueMin: number } {
  const now = opts.now ?? new Date();
  const graceMin = opts.graceMin ?? DEFAULT_GRACE_MIN;
  const last = opts.lastReportAt ? Date.parse(opts.lastReportAt) : NaN;
  // No timestamp to judge against → don't nag without a basis.
  const overdueMin = Number.isFinite(last) ? Math.max(0, (now.getTime() - last) / 60000) : 0;

  if (overdueMin < opts.intervalMin) {
    return { stage: "ok", action: "none", overdueMin };
  }
  if (overdueMin < opts.intervalMin + graceMin) {
    return opts.stage === "ok"
      ? { stage: "reminded", action: "remind", overdueMin }
      : { stage: opts.stage, action: "none", overdueMin };
  }
  return opts.stage === "escalated"
    ? { stage: "escalated", action: "none", overdueMin }
    : { stage: "escalated", action: "escalate", overdueMin };
}
