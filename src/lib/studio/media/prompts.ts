import type { CreativePlan, ImageAspect } from "@/lib/studio/types";

/**
 * Image prompt assembly. The brand style preset (Settings → สื่อ) comes first,
 * then the scene from the creative plan, then FIXED safety negatives that the
 * owner cannot remove: generated visuals must never depict identifiable people,
 * plates, names or other people's logos — the same privacy stance as the text.
 */

export const IMAGE_SAFETY_NEGATIVES =
  "Strictly no real or identifiable human faces (use silhouettes, back views, hands, or objects), no readable licence plates, no readable personal names, phone numbers or documents, no third-party brand logos, no gore, no weapons pointed at people. No text or captions in the image.";

export type ImageTarget = { kind: "thumbnail" } | { kind: "scene"; index: number } | { kind: "presenter" } | { kind: "custom"; text: string };

/**
 * The storyteller format's presenter: an anonymous detective as a pure backlit silhouette. The wording is fixed so
 * every clip gets a similar-looking narrator, and it already satisfies IMAGE_SAFETY_NEGATIVES (no face at all).
 */
export const PRESENTER_SCENE =
  "An anonymous private investigator sitting on a chair in a dark office, turned toward the camera like a documentary interview. Strong window backlight behind him turns his whole body and head into a pure black silhouette with no facial features visible at all. Rain-streaked window with Bangkok night city bokeh behind, light haze, a faint desk lamp glow at the edge of frame. Medium shot, subject centered in the upper two thirds.";

export const MAX_CUSTOM_PROMPT_CHARS = 600;

export function describeImageTarget(target: ImageTarget, plan: CreativePlan | null): string {
  if (target.kind === "thumbnail") return "ปก";
  if (target.kind === "presenter") return "นักสืบนิรนาม (คนเล่าเรื่อง)";
  if (target.kind === "scene") {
    const shot = plan?.shots?.[target.index];
    return shot ? `ฉาก ${target.index + 1} (${fmt(shot.start_sec)}–${fmt(shot.end_sec)})` : `ฉาก ${target.index + 1}`;
  }
  return "กำหนดเอง";
}

/** Returns null when the plan has nothing to draw from for this target. */
export function sceneText(target: ImageTarget, plan: CreativePlan | null, fallbackTitle: string): string | null {
  if (target.kind === "custom") return target.text.trim().slice(0, MAX_CUSTOM_PROMPT_CHARS) || null;
  if (target.kind === "presenter") return PRESENTER_SCENE;
  if (target.kind === "thumbnail") {
    const concept = plan?.thumbnail_concept?.trim();
    return concept || `Cover image for a short video titled "${fallbackTitle}"`;
  }
  const shot = plan?.shots?.[target.index];
  if (!shot) return null;
  const visual = shot.visual?.trim();
  if (!visual) return null;
  const overlay = shot.text_overlay?.trim();
  return overlay ? `${visual}. (Mood cue only, do not render the words: "${overlay}")` : visual;
}

export function buildImagePrompt(input: { style: string; scene: string; aspect: ImageAspect; broll?: string[]; musicMood?: string | null }): string {
  const parts = [
    input.style.trim() || "Cinematic documentary photography, realistic, muted palette.",
    `Scene: ${input.scene.trim()}`,
    input.broll?.length ? `Related B-roll context: ${input.broll.slice(0, 3).join("; ")}` : null,
    input.musicMood ? `Overall mood: ${input.musicMood}` : null,
    `Composition for a ${input.aspect} frame.`,
    IMAGE_SAFETY_NEGATIVES,
  ];
  return parts.filter(Boolean).join("\n");
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
