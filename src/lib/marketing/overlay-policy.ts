/**
 * Overlay policy for the marketing site — pure decisions, no DOM.
 *
 * Audit finding (Part 10 / Appendix): on mobile the site stacked a sticky
 * contact bar, an auto-opening contact FAB, an AI launcher and a 40 s
 * "exit-intent" modal on top of each other. That costs CLS, hides content,
 * and is penalised by Google's intrusive-interstitial guidance. Policy:
 *
 * - Contact FAB auto-opens once per session on desktop only (≥ 1024 px); on
 *   mobile the sticky bar already shows the channels, so the FAB stays closed.
 * - Exit-intent is desktop-only (mouse leaving the viewport). No mobile timer.
 * - The AI launcher appears after the visitor's first interaction (scroll,
 *   tap, key) or after a short grace period — never in the first paint.
 *
 * Kept as pure functions so the thresholds are unit-tested and documented.
 */

/** Tailwind `lg` breakpoint — matches `lg:hidden` on the sticky contact bar. */
export const DESKTOP_MIN_WIDTH = 1024;
/** Delay before the FAB auto-opens on desktop (once per session). */
export const FAB_AUTO_OPEN_DELAY_MS = 1800;
/** Grace period after which the AI launcher appears even without interaction. */
export const ASSISTANT_LAUNCHER_DELAY_MS = 6000;

export interface OverlayEnv {
  /** `window.innerWidth` at decision time. */
  viewportWidth: number;
  /** `matchMedia("(pointer: fine)").matches` — a mouse/trackpad is present. */
  finePointer: boolean;
  /** Session flag: the overlay already fired this session. */
  alreadyShown: boolean;
}

export function isDesktop(viewportWidth: number): boolean {
  return Number.isFinite(viewportWidth) && viewportWidth >= DESKTOP_MIN_WIDTH;
}

/** Should the contact FAB pop open on its own after `FAB_AUTO_OPEN_DELAY_MS`? */
export function shouldAutoOpenFab(env: Pick<OverlayEnv, "viewportWidth" | "alreadyShown">): boolean {
  if (env.alreadyShown) return false;
  return isDesktop(env.viewportWidth);
}

export type ExitIntentMode = "mouse" | "off";

/**
 * How exit-intent may trigger. "mouse" = listen for the cursor leaving the top
 * of the viewport; "off" = never (touch devices, small screens, already seen).
 */
export function exitIntentMode(env: OverlayEnv): ExitIntentMode {
  if (env.alreadyShown) return "off";
  if (!isDesktop(env.viewportWidth)) return "off";
  if (!env.finePointer) return "off";
  return "mouse";
}

/** Is a `mouseout` event an exit toward the browser chrome (top edge)? */
export function isExitMouseOut(e: { clientY: number; relatedTarget: unknown }): boolean {
  return e.clientY <= 0 && !e.relatedTarget;
}

/** Should the AI launcher be visible yet? */
export function shouldShowAssistantLauncher(state: { interacted: boolean; elapsedMs: number }): boolean {
  return state.interacted || state.elapsedMs >= ASSISTANT_LAUNCHER_DELAY_MS;
}
