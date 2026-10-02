/**
 * Human paragraph for AI-drafted articles (audit Days 31–90). Drafts for
 * content-calendar topics carry a marker where the owner's first-hand
 * paragraph goes; the review page collects it and `insertHumanParagraph`
 * splices it in before publishing. Pure helpers, unit-tested.
 */
export const HUMAN_PARAGRAPH_MARKER = "[[OWNER_PARAGRAPH]]";

export function hasHumanParagraphMarker(body: string): boolean {
  return body.includes(HUMAN_PARAGRAPH_MARKER);
}

/** Bounds for the owner's paragraph (characters). */
export const HUMAN_PARAGRAPH_MIN = 120;
export const HUMAN_PARAGRAPH_MAX = 1500;

export function isValidHumanParagraph(text: string | null | undefined): text is string {
  const t = (text ?? "").trim();
  return t.length >= HUMAN_PARAGRAPH_MIN && t.length <= HUMAN_PARAGRAPH_MAX && !/<[a-z/!][^>]*>/i.test(t);
}

/**
 * Replace the marker with the owner's paragraph (as its own Markdown
 * paragraph). Without a marker, insert after the first paragraph that follows
 * the first heading-free block, i.e. right after the intro.
 */
export function insertHumanParagraph(body: string, paragraph: string): string {
  const p = paragraph.trim();
  if (hasHumanParagraphMarker(body)) return body.split(HUMAN_PARAGRAPH_MARKER).join(p);
  const blocks = body.split(/\n{2,}/);
  const firstProse = blocks.findIndex((b) => b.trim() && !b.trim().startsWith("#"));
  if (firstProse === -1) return `${body.trimEnd()}\n\n${p}\n`;
  blocks.splice(firstProse + 1, 0, p);
  return blocks.join("\n\n");
}
