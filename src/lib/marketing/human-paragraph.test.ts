import { describe, expect, it } from "vitest";
import { HUMAN_PARAGRAPH_MARKER, hasHumanParagraphMarker, insertHumanParagraph, isValidHumanParagraph } from "./human-paragraph";

const PARA = "จากประสบการณ์ของทีมเราในหลายร้อยเคส สิ่งที่ลูกค้ามักประเมินต่ำไปคือเวลาที่ต้องใช้ในการเตรียมข้อมูลตั้งต้นให้ครบ ซึ่งมีผลต่อราคาและความเร็วของงานโดยตรง";

describe("human paragraph", () => {
  it("validates length and rejects HTML", () => {
    expect(isValidHumanParagraph(PARA)).toBe(true);
    expect(isValidHumanParagraph("สั้นไป")).toBe(false);
    expect(isValidHumanParagraph(null)).toBe(false);
    expect(isValidHumanParagraph(`${PARA} <script>alert(1)</script>`)).toBe(false);
    expect(isValidHumanParagraph("x".repeat(1501))).toBe(false);
  });

  it("replaces the marker when present (every occurrence)", () => {
    const body = `# T\n\nintro\n\n${HUMAN_PARAGRAPH_MARKER}\n\n## H2\n\nmore ${HUMAN_PARAGRAPH_MARKER}`;
    const out = insertHumanParagraph(body, PARA);
    expect(hasHumanParagraphMarker(out)).toBe(false);
    expect(out.split(PARA).length - 1).toBe(2);
  });

  it("inserts after the intro paragraph when there is no marker", () => {
    const body = "# Title\n\nIntro paragraph.\n\n## First heading\n\nBody.";
    const out = insertHumanParagraph(body, PARA);
    expect(out.split(/\n{2,}/)).toEqual(["# Title", "Intro paragraph.", PARA, "## First heading", "Body."]);
  });

  it("appends when the body has no prose", () => {
    expect(insertHumanParagraph("# Only heading", PARA)).toBe(`# Only heading\n\n${PARA}\n`);
  });
});
