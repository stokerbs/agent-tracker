import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Keep NextResponse real; only stub after() so the notification isn't scheduled.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    void fn();
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  notifyRole: vi.fn(),
  notificationLinks: { leads: () => "/leads" },
}));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn() }));

import { POST } from "./route";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyRole } from "@/lib/notifications";
import { reportError } from "@/lib/errors";
import { LEAD_REF_PATTERN } from "@/lib/marketing/zh/lead-ref";

/** Service-role client stub: leads insert (chainable .select().single()), files insert, storage upload. */
function svc(opts: { leadErrors?: ({ code: string; message: string } | null)[]; uploadError?: unknown; fileInsertError?: unknown } = {}) {
  const leadErrors = [...(opts.leadErrors ?? [null])];
  const leadInsert = vi.fn().mockImplementation(() => ({
    select: () => ({
      single: async () => {
        const err = leadErrors.shift() ?? null;
        return err ? { data: null, error: err } : { data: { id: "lead-uuid" }, error: null };
      },
    }),
  }));
  const fileInsert = vi.fn().mockResolvedValue({ error: opts.fileInsertError ?? null });
  const upload = vi.fn().mockResolvedValue({ error: opts.uploadError ?? null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const client = {
    from: (table: string) => (table === "marketing_leads" ? { insert: leadInsert } : { insert: fileInsert }),
    storage: { from: () => ({ upload, remove }) },
  };
  return { client, leadInsert, fileInsert, upload, remove };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0]);

const valid: Record<string, string> = {
  name: "王先生",
  wechatId: "wang_88",
  country: "china",
  targetLocation: "bangkok",
  service: "relationship",
  knownInfo: "对方在曼谷素坤逸工作，有照片。",
  objective: "确认对方的日常生活情况。",
  estimatedDuration: "4-7_days",
  urgency: "normal",
  budgetRange: "50k-100k",
  consent: "true",
};

function req(fields: Record<string, string>, files: File[] = [], { ip = "1.2.3.4", contentLength = 1024 } = {}): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const f of files) fd.append("files", f);
  const headers = new Map([["x-forwarded-for", ip], ["user-agent", "test-ua"], ["content-length", String(contentLength)]]);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    formData: async () => fd,
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 2, retryAfterMs: 0 } as never);
  vi.mocked(createServiceClient).mockReturnValue(svc().client as never);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/marketing/zh-intake", () => {
  it("creates the lead with a Case Lead ID and notifies admins", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.leadRef).toMatch(LEAD_REF_PATTERN);
    expect(s.leadInsert).toHaveBeenCalledWith(expect.objectContaining({
      wechat_id: "wang_88", country: "china", service: "relationship", locale: "zh", source: "zh_intake", stage: "new", phone: null, lead_ref: body.leadRef,
    }));
    expect(vi.mocked(notifyRole)).toHaveBeenCalledWith(["admin"], expect.objectContaining({ priority: "high" }));
  });

  it("429 when rate-limited, before parsing", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 60_000 } as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("413 when the declared body exceeds the cap", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid, [], { contentLength: 50 * 1024 * 1024 }));
    expect(res.status).toBe(413);
    expect(s.leadInsert).not.toHaveBeenCalled();
  });

  it("honeypot: fake success, nothing stored, even when other fields are invalid", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ name: "bot", website: "http://spam" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
    expect(s.leadInsert).not.toHaveBeenCalled();
    expect(vi.mocked(notifyRole)).not.toHaveBeenCalled();
  });

  it("400 invalid_input without consent or with a free-text country", async () => {
    const { consent: _c, ...noConsent } = valid;
    expect((await POST(req(noConsent))).status).toBe(400);
    expect((await POST(req({ ...valid, country: "中国" }))).status).toBe(400);
  });

  it("rejects a file whose bytes don't match its declared type, before any insert", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const fake = new File([EXE], "report.jpg", { type: "image/jpeg" });
    const res = await POST(req(valid, [fake]));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "file_rejected" });
    expect(s.leadInsert).not.toHaveBeenCalled();
    expect(s.upload).not.toHaveBeenCalled();
  });

  it("rejects disallowed types and too many files", async () => {
    const html = new File([new TextEncoder().encode("<html>")], "x.html", { type: "text/html" });
    expect((await POST(req(valid, [html]))).status).toBe(400);
    const six = Array.from({ length: 6 }, (_, i) => new File([JPEG], `${i}.jpg`, { type: "image/jpeg" }));
    expect((await POST(req(valid, six))).status).toBe(400);
  });

  it("uploads valid files under a UUID key and records them", async () => {
    const s = svc();
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const photo = new File([JPEG], "../../evil name?.jpg", { type: "image/jpeg" });
    const res = await POST(req(valid, [photo]));
    expect(res.status).toBe(200);
    expect(s.upload).toHaveBeenCalledTimes(1);
    const [key] = s.upload.mock.calls[0]!;
    expect(key).toMatch(/^lead-uuid\/[0-9a-f-]{36}\.jpg$/);
    expect(s.fileInsert).toHaveBeenCalledWith(expect.objectContaining({ lead_id: "lead-uuid", mime_type: "image/jpeg", file_name: ".._.._evil name_.jpg" }));
  });

  it("keeps the lead when a storage upload fails", async () => {
    const s = svc({ uploadError: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid, [new File([JPEG], "a.jpg", { type: "image/jpeg" })]));
    expect(res.status).toBe(200);
    expect(s.fileInsert).not.toHaveBeenCalled();
    expect(vi.mocked(reportError)).toHaveBeenCalledWith(expect.anything(), "marketing:zh-intake:upload");
  });

  it("removes the uploaded object when its file row cannot be written", async () => {
    const s = svc({ fileInsertError: { message: "row failed" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid, [new File([JPEG], "a.jpg", { type: "image/jpeg" })]));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, filesUploaded: 0, filesFailed: 1 });
    const [key] = s.upload.mock.calls[0]!;
    expect(s.remove).toHaveBeenCalledWith([key]);
    expect(vi.mocked(reportError)).toHaveBeenCalledWith(expect.anything(), "marketing:zh-intake:file-row");
  });

  it("retries the lead_ref on a unique-violation and gives up after 3", async () => {
    const dup = { code: "23505", message: "duplicate" };
    const s = svc({ leadErrors: [dup, null] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    expect((await POST(req(valid))).status).toBe(200);
    expect(s.leadInsert).toHaveBeenCalledTimes(2);

    const s2 = svc({ leadErrors: [dup, dup, dup] });
    vi.mocked(createServiceClient).mockReturnValue(s2.client as never);
    expect((await POST(req(valid))).status).toBe(500);
  });

  it("500 on a non-duplicate insert error", async () => {
    const s = svc({ leadErrors: [{ code: "42P01", message: "nope" }] });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(500);
    expect(vi.mocked(reportError)).toHaveBeenCalledWith(expect.anything(), "marketing:zh-intake:insert");
  });
});
