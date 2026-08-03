import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));
vi.mock("@/lib/line/content", () => ({ downloadLineContent: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyCaseParticipants: vi.fn() }));
// Default-allowed so every existing test below doesn't need to opt in
// explicitly; the one rate-limiting test overrides with mockResolvedValueOnce.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 1, retryAfterMs: 0 })),
}));

import { handleAttachPhotoCommand } from "./attach-photo";
import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import { downloadLineContent } from "@/lib/line/content";
import { notifyCaseParticipants } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_IMAGE_SIZE } from "@/lib/security/file-validation";
import { BUCKETS } from "@/lib/constants";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const CASE_ID = "case-1";
const ENTRY_ID = "entry-1";
const MESSAGE_ID = "line-message-id-1";
const PROFILE_ID = "33333333-3333-3333-3333-333333333333";

// ─── minimal query-builder stand-ins ────────────────────────────────────────

type Result = { data: unknown; error: unknown };

/** Chainable stand-in for `svc.from(table).select(...).eq(...).eq(...).maybeSingle()`
 * — used for both the case_agents re-authorization query and the agents
 * profile_id lookup. Every filter method is a `vi.fn()` that returns itself
 * so calls stay chainable AND are inspectable afterward (the authorization
 * regression guard below asserts on the exact `.eq()` args). */
function chainable(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(async () => result);
  return b as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

type Builder = ReturnType<typeof chainable>;

// ─── JPEG bytes for validateImageUpload()'s real magic-number check ────────

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];

function jpegBuffer(size = 128): Buffer {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < JPEG_MAGIC.length; i++) buf[i] = JPEG_MAGIC[i]!;
  return buf;
}

// ─── svc mock ────────────────────────────────────────────────────────────────

function makeSvc({
  caseAgentsResult = { data: { case_id: CASE_ID }, error: null },
  agentsResult = { data: { profile_id: PROFILE_ID }, error: null },
  evidenceInsertResult = { error: null },
  uploadError = null,
}: {
  caseAgentsResult?: Result;
  agentsResult?: Result;
  evidenceInsertResult?: { error: unknown };
  uploadError?: unknown;
} = {}) {
  const caseAgentsBuilders: Builder[] = [];
  const agentsBuilders: Builder[] = [];
  const evidenceInsertMock = vi.fn(async (_row: Record<string, unknown>) => evidenceInsertResult);
  const evidenceBuilders: { insert: typeof evidenceInsertMock }[] = [];
  const uploadMock = vi.fn(async (_path: string, _file: File, _opts: unknown) => ({ error: uploadError }));
  const storageFromMock = vi.fn((_bucket: string) => ({ upload: uploadMock }));
  const requestedTables: string[] = [];

  return {
    caseAgentsBuilders,
    agentsBuilders,
    evidenceBuilders,
    evidenceInsertMock,
    uploadMock,
    storageFromMock,
    requestedTables,
    storage: { from: storageFromMock },
    from(table: string) {
      requestedTables.push(table);
      if (table === "case_agents") {
        const b = chainable(caseAgentsResult);
        caseAgentsBuilders.push(b);
        return b;
      }
      if (table === "agents") {
        const b = chainable(agentsResult);
        agentsBuilders.push(b);
        return b;
      }
      if (table === "evidence") {
        const b = { insert: evidenceInsertMock };
        evidenceBuilders.push(b);
        return b;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function lastReply(): string {
  const calls = vi.mocked(replyLineMessage).mock.calls;
  return calls[calls.length - 1]?.[1] ?? "";
}

function mockDownloadSuccess(data: Buffer = jpegBuffer(), contentType = "image/jpeg") {
  vi.mocked(downloadLineContent).mockResolvedValue({ ok: true, data, contentType });
}

afterEach(() => vi.clearAllMocks());

describe("handleAttachPhotoCommand", () => {
  // ── 0. rate limiting ────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("replies RATE_LIMITED and never touches the DB/Storage when the agent is rate-limited", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 1000 });

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.RATE_LIMITED);
      expect(createServiceClient).not.toHaveBeenCalled();
      expect(downloadLineContent).not.toHaveBeenCalled();
    });

    it("checks the line_attach_photo bucket keyed by agentId", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(checkRateLimit).toHaveBeenCalledWith("line_attach_photo", AGENT_ID);
    });
  });

  // ── 1. re-authorization ────────────────────────────────────────────────

  describe("re-authorization", () => {
    it("proceeds past the auth check on a genuine case_agents match", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_SUCCESS);
    });

    it("replies ATTACH_PHOTO_UNAUTHORIZED (generic, non-leaking) when no case_agents row matches", async () => {
      const svc = makeSvc({ caseAgentsResult: { data: null, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_UNAUTHORIZED);
      // Never even reaches the download/upload steps once unauthorized.
      expect(downloadLineContent).not.toHaveBeenCalled();
      expect(svc.evidenceBuilders.length).toBe(0);
      expect(svc.uploadMock).not.toHaveBeenCalled();
    });

    it("replies GENERIC_ERROR (not ATTACH_PHOTO_UNAUTHORIZED) when the authorization query itself errors", async () => {
      const svc = makeSvc({ caseAgentsResult: { data: null, error: { message: "db down" } } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.GENERIC_ERROR);
      expect(downloadLineContent).not.toHaveBeenCalled();
    });

    it("authorization regression guard: the re-check is genuinely scoped to (case_id = pendingCaseId, agent_id = agentId), not a blind mock", async () => {
      const OTHER_CASE_ID = "case-other";
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, OTHER_CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      const builder = svc.caseAgentsBuilders[0]!;
      expect(builder.eq).toHaveBeenCalledWith("case_id", OTHER_CASE_ID);
      expect(builder.eq).toHaveBeenCalledWith("agent_id", AGENT_ID);
      // The insert must reference the case actually authorized against, not
      // some other id — proves the filter args genuinely drive behavior.
      const insertArg = svc.evidenceBuilders[0]!.insert.mock.calls[0]![0] as { case_id: string };
      expect(insertArg.case_id).toBe(OTHER_CASE_ID);
    });
  });

  // ── 2. download ─────────────────────────────────────────────────────────

  describe("download", () => {
    it("replies ATTACH_PHOTO_DOWNLOAD_FAILED and never touches Storage/DB when downloadLineContent fails", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      vi.mocked(downloadLineContent).mockResolvedValue({ ok: false, error: "http_500" });

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_DOWNLOAD_FAILED);
      expect(svc.evidenceBuilders.length).toBe(0);
      expect(svc.uploadMock).not.toHaveBeenCalled();
    });
  });

  // ── 3. validation ───────────────────────────────────────────────────────

  describe("validation", () => {
    it("rejects an unsupported content-type without touching Storage/DB", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess(Buffer.from("not-an-image"), "image/gif");

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_INVALID_TYPE);
      expect(svc.evidenceBuilders.length).toBe(0);
      expect(svc.uploadMock).not.toHaveBeenCalled();
    });

    it("rejects a file exceeding MAX_IMAGE_SIZE with a size-specific reply", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess(jpegBuffer(MAX_IMAGE_SIZE + 1));

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toContain("10MB");
      expect(svc.evidenceBuilders.length).toBe(0);
      expect(svc.uploadMock).not.toHaveBeenCalled();
    });

    it("accepts a file at exactly MAX_IMAGE_SIZE (boundary, not rejected as too large)", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess(jpegBuffer(MAX_IMAGE_SIZE));

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_SUCCESS);
      expect(svc.uploadMock).toHaveBeenCalled();
    }, 15_000);

    it("rejects content whose bytes don't match the declared image/jpeg type (magic-number spoof)", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess(Buffer.from("<html>not a real jpeg</html>"), "image/jpeg");

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_INVALID_TYPE);
      expect(svc.uploadMock).not.toHaveBeenCalled();
    });
  });

  // ── 4. successful upload ───────────────────────────────────────────────

  describe("successful upload", () => {
    it("uploads to Storage under `${caseId}/<uuid>.<ext>` and inserts the evidence row with the correct shape", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess(jpegBuffer(), "image/jpeg");

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(svc.storageFromMock).toHaveBeenCalledWith(BUCKETS.evidence);
      const uploadCall = svc.uploadMock.mock.calls[0]!;
      const path = uploadCall[0] as string;
      expect(path).toMatch(
        new RegExp(`^${CASE_ID}/[0-9a-f-]{36}\\.jpg$`),
      );

      const insertArg = svc.evidenceBuilders[0]!.insert.mock.calls[0]![0] as Record<string, unknown>;
      expect(insertArg).toMatchObject({
        case_id: CASE_ID,
        type: "photo",
        storage_path: path,
        mime_type: "image/jpeg",
        timeline_entry_id: ENTRY_ID,
        uploaded_by: PROFILE_ID,
      });
      expect(insertArg.file_name).toMatch(/\.jpg$/);
      expect(insertArg.file_size).toBeGreaterThan(0);

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_SUCCESS);
    });

    it("derives the extension from the content-type for png/webp too", async () => {
      const svcPng = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svcPng as never);
      const pngMagic = Buffer.alloc(64);
      [0x89, 0x50, 0x4e, 0x47].forEach((b, i) => (pngMagic[i] = b));
      mockDownloadSuccess(pngMagic, "image/png");

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      const path = svcPng.uploadMock.mock.calls[0]![0] as string;
      expect(path).toMatch(/\.png$/);
    });

    it("falls back to a null uploaded_by when the agent has no linked profile", async () => {
      const svc = makeSvc({ agentsResult: { data: { profile_id: null }, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      const insertArg = svc.evidenceBuilders[0]!.insert.mock.calls[0]![0] as Record<string, unknown>;
      expect(insertArg.uploaded_by).toBeNull();
    });

    it("does NOT clear (or touch at all) line_accounts.pending_attachment_* on success", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(svc.requestedTables).not.toContain("line_accounts");
    });

    it("sends a best-effort case-team notification, excluding the uploader's profile, without blocking the reply", async () => {
      const svc = makeSvc();
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(notifyCaseParticipants).toHaveBeenCalledWith(
        CASE_ID,
        expect.objectContaining({ includeClient: false, exclude: PROFILE_ID }),
      );
    });
  });

  // ── 5. DB/storage error paths ──────────────────────────────────────────

  describe("DB/storage error paths", () => {
    it("replies GENERIC_ERROR and never inserts an evidence row when the Storage upload fails", async () => {
      const svc = makeSvc({ uploadError: { message: "storage down" } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.GENERIC_ERROR);
      expect(svc.evidenceBuilders.length).toBe(0);
    });

    it("replies GENERIC_ERROR when the evidence insert fails (upload already succeeded)", async () => {
      const svc = makeSvc({ evidenceInsertResult: { error: { message: "insert failed" } } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();
      vi.spyOn(console, "error").mockImplementation(() => {});

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.GENERIC_ERROR);
      expect(svc.uploadMock).toHaveBeenCalled();
      expect(notifyCaseParticipants).not.toHaveBeenCalled();
    });

    it("still succeeds (uploaded_by falls back to null) when the agent-profile lookup itself errors", async () => {
      const svc = makeSvc({ agentsResult: { data: null, error: { message: "lookup failed" } } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      mockDownloadSuccess();
      vi.spyOn(console, "error").mockImplementation(() => {});

      await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");

      expect(lastReply()).toBe(msg.ATTACH_PHOTO_SUCCESS);
      const insertArg = svc.evidenceBuilders[0]!.insert.mock.calls[0]![0] as Record<string, unknown>;
      expect(insertArg.uploaded_by).toBeNull();
    });
  });
});
