/** Token-gated approve/reject: human paragraph gating, splice, publish, revalidation. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getArticleByToken: vi.fn(),
  decideArticle: vi.fn(),
  setDraftBodies: vi.fn(),
  revalidatePath: vi.fn(),
  logAudit: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/lib/marketing/articles-db", () => ({ getArticleByToken: h.getArticleByToken, decideArticle: h.decideArticle, setDraftBodies: h.setDraftBodies }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/errors", () => ({ reportError: h.reportError }));

import { approveArticle, rejectArticle } from "./actions";
import { CONTENT_CALENDAR } from "@/lib/marketing/content-calendar";
import { HUMAN_PARAGRAPH_MARKER } from "@/lib/marketing/human-paragraph";

const TOKEN = "tok_123";
const PARA_TH = "จากประสบการณ์ของทีมเราในหลายร้อยเคส สิ่งที่ลูกค้ามักประเมินต่ำไปคือเวลาที่ต้องใช้ในการเตรียมข้อมูลตั้งต้นให้ครบ ซึ่งมีผลต่อราคาและความเร็วของงานโดยตรง";
const PARA_EN = "In our experience across hundreds of cases, the step clients most often underestimate is assembling the starting information, which directly drives both the price and how fast the assignment moves.";
const calendarDraft = {
  id: "a1", status: "draft", topic: CONTENT_CALENDAR[0]!.th, service: "how_it_works", zh_slug: "文章", cover_category: "general",
  th_body: `# หัวข้อ\n\nบทนำ\n\n${HUMAN_PARAGRAPH_MARKER}\n\n## H2\n\nเนื้อหา`, en_body: "# Title\n\nIntro.\n\n## H2\n\nBody.",
};
const evergreenDraft = { ...calendarDraft, id: "a2", topic: "เช็คประวัติบุคคลจากชื่อนามสกุล", service: "background", th_body: "# ก\n\nข", en_body: "# a\n\nb" };
function fd(th?: string, en?: string) {
  const f = new FormData();
  if (th !== undefined) f.set("humanParagraphTh", th);
  if (en !== undefined) f.set("humanParagraphEn", en);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getArticleByToken.mockResolvedValue(calendarDraft);
  h.decideArticle.mockResolvedValue("published");
  h.setDraftBodies.mockResolvedValue(true);
});

describe("approveArticle", () => {
  it("not_found for an unknown token", async () => {
    h.getArticleByToken.mockResolvedValueOnce(null);
    expect(await approveArticle("nope", fd())).toEqual({ ok: false, error: "not_found" });
    expect(h.decideArticle).not.toHaveBeenCalled();
  });

  it("a calendar draft refuses to publish without both paragraphs, or with short / HTML ones", async () => {
    expect(await approveArticle(TOKEN, fd())).toEqual({ ok: false, error: "human_paragraph_required" });
    expect(await approveArticle(TOKEN, fd(PARA_TH, ""))).toEqual({ ok: false, error: "human_paragraph_required" });
    expect(await approveArticle(TOKEN, fd("สั้นไป", PARA_EN))).toEqual({ ok: false, error: "human_paragraph_invalid" });
    expect(await approveArticle(TOKEN, fd(PARA_TH, `${PARA_EN} <img src=x onerror=alert(1)>`))).toEqual({ ok: false, error: "human_paragraph_invalid" });
    expect(h.setDraftBodies).not.toHaveBeenCalled();
    expect(h.decideArticle).not.toHaveBeenCalled();
  });

  it("splices the paragraphs (marker replaced / after intro), audits, publishes and revalidates TH/EN/ZH surfaces", async () => {
    expect(await approveArticle(TOKEN, fd(PARA_TH, PARA_EN))).toEqual({ ok: true });
    const bodies = h.setDraftBodies.mock.calls[0]![1] as { th_body: string; en_body: string };
    expect(bodies.th_body).not.toContain(HUMAN_PARAGRAPH_MARKER);
    expect(bodies.th_body).toContain(PARA_TH);
    expect(bodies.en_body.split(/\n{2,}/)).toEqual(["# Title", "Intro.", PARA_EN, "## H2", "Body."]);
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ARTICLE_HUMAN_PARAGRAPH", entityId: "a1" }));
    expect(h.decideArticle).toHaveBeenCalledWith(TOKEN, "published");
    const paths = h.revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining([`/review/${TOKEN}`, "/articles", "/en/articles", "/zh/articles", "/ขั้นตอนการทำงาน", "/en/how-it-works", "/zh"]));
  });

  it("an evergreen draft publishes without a paragraph and never touches the bodies", async () => {
    h.getArticleByToken.mockResolvedValueOnce(evergreenDraft);
    expect(await approveArticle(TOKEN, fd())).toEqual({ ok: true });
    expect(h.setDraftBodies).not.toHaveBeenCalled();
    expect(h.revalidatePath).toHaveBeenCalledWith("/en/background-check");
  });

  it("update_failed + reportError when the splice cannot be stored; not_found when the draft is no longer pending", async () => {
    h.setDraftBodies.mockRejectedValueOnce(new Error("db down"));
    expect(await approveArticle(TOKEN, fd(PARA_TH, PARA_EN))).toEqual({ ok: false, error: "update_failed" });
    expect(h.reportError).toHaveBeenCalled();
    expect(h.decideArticle).not.toHaveBeenCalled();

    h.setDraftBodies.mockResolvedValueOnce(false);
    expect(await approveArticle(TOKEN, fd(PARA_TH, PARA_EN))).toEqual({ ok: false, error: "not_found" });

    h.getArticleByToken.mockResolvedValueOnce(evergreenDraft);
    h.decideArticle.mockResolvedValueOnce(null); // decided on another device meanwhile
    expect(await approveArticle(TOKEN, fd())).toEqual({ ok: false, error: "not_found" });
  });
});

describe("rejectArticle", () => {
  it("rejects and re-renders the review page", async () => {
    h.decideArticle.mockResolvedValueOnce("rejected");
    await rejectArticle(TOKEN);
    expect(h.decideArticle).toHaveBeenCalledWith(TOKEN, "rejected");
    expect(h.revalidatePath).toHaveBeenCalledWith(`/review/${TOKEN}`);
  });
});
