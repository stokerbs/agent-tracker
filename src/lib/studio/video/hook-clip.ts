import "server-only";

import type { TimedShot } from "./timeline";

/**
 * Motion hook wiring for the renderer (docs §17), kept separate from render.ts so the fallbacks are testable.
 *
 * The rule is the same everywhere: a motion hook is a bonus, never a requirement. If the job opted out, if no
 * clip is ready, or if the clip cannot be fetched, the first shot keeps its still and the render carries on.
 */

export function motionHookEnabled(params: unknown): boolean {
  return (params as { motion_hook?: unknown } | null)?.motion_hook !== false;
}

export interface MotionHookDeps {
  find: () => Promise<{ id: string; storage_path: string | null } | null>;
  download: (asset: { id: string; storage_path: string | null }) => Promise<Uint8Array>;
  write: (bytes: Uint8Array) => Promise<string>;
  onSkip?: (reason: string) => void;
}

/** Sets `videoPath` on the first shot when a ready clip can be fetched. Returns whether it did. */
export async function attachMotionHook(shots: TimedShot[], params: unknown, deps: MotionHookDeps): Promise<boolean> {
  if (!shots.length || !motionHookEnabled(params)) return false;
  let asset: { id: string; storage_path: string | null } | null;
  try {
    asset = await deps.find();
  } catch (e) {
    deps.onSkip?.(`lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
  if (!asset) return false;
  try {
    const bytes = await deps.download(asset);
    shots[0].videoPath = await deps.write(bytes);
    return true;
  } catch (e) {
    deps.onSkip?.(`clip unusable: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
