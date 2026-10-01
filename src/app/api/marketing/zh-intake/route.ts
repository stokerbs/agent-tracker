import { NextResponse, type NextRequest, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyRole, notificationLinks } from "@/lib/notifications";
import { reportError } from "@/lib/errors";
import {
  zhIntakeSchema, intakeFromFormData,
  ZH_INTAKE_MAX_FILES, ZH_INTAKE_MAX_FILE_BYTES, ZH_INTAKE_MAX_TOTAL_BYTES, ZH_INTAKE_MAX_BODY_BYTES, ZH_INTAKE_ALLOWED_MIME,
} from "@/lib/marketing/zh/intake-schema";
import { generateLeadRef } from "@/lib/marketing/zh/lead-ref";
import { sniffMime } from "@/lib/marketing/zh/file-sniff";

/**
 * Public, unauthenticated endpoint — the Chinese intake form posts here as
 * multipart/form-data (fields + up to 5 files). Mirrors /api/marketing/lead:
 * rate-limit → validate (zod is the authority) → honeypot → service-role
 * insert → file upload to the private `lead-files` bucket → notify admins.
 * Returns the Case Lead ID the client sees.
 */
const BUCKET = "lead-files";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Keep only a safe display name — the storage key is a UUID regardless. */
function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "file";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = await checkRateLimit("zh_intake", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Refuse oversized bodies before buffering the multipart payload.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared > ZH_INTAKE_MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "file_rejected" }, { status: 413 });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // Honeypot first — a bot that filled it must never learn whether the rest
  // of its payload would have validated. Pretend success, store nothing.
  const website = fd.get("website");
  if (typeof website === "string" && website.length > 0) {
    return NextResponse.json({ ok: true, leadRef: generateLeadRef() });
  }

  const parsed = zhIntakeSchema.safeParse(intakeFromFormData(fd));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const { website: _hp, ...data } = parsed.data;

  // Files: validate BEFORE any DB write so a bad attachment never leaves a
  // half-created lead behind. The declared MIME type is only an assertion —
  // the first bytes must agree with it.
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > ZH_INTAKE_MAX_FILES) return NextResponse.json({ ok: false, error: "file_rejected" }, { status: 400 });
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (f.size > ZH_INTAKE_MAX_FILE_BYTES || total > ZH_INTAKE_MAX_TOTAL_BYTES || !(ZH_INTAKE_ALLOWED_MIME as readonly string[]).includes(f.type)) {
      return NextResponse.json({ ok: false, error: "file_rejected" }, { status: 400 });
    }
    const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
    if (sniffMime(head) !== f.type) {
      return NextResponse.json({ ok: false, error: "file_rejected" }, { status: 400 });
    }
  }

  const svc = createServiceClient();
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const nowIso = new Date().toISOString();
  const row = {
    name: data.name,
    phone: null,
    email: data.email ? data.email : null,
    wechat_id: data.wechatId,
    country: data.country,
    target_location: data.targetLocation,
    service: data.service,
    case_type: data.service,
    known_info: data.knownInfo,
    objective: data.objective,
    message: data.objective,
    preferred_start: data.preferredStart ? data.preferredStart : null,
    estimated_duration: data.estimatedDuration,
    urgency: data.urgency,
    budget_range: data.budgetRange,
    landing_page: data.landingPage || null,
    referrer: data.referrer || null,
    utm_source: data.utmSource || null,
    utm_medium: data.utmMedium || null,
    utm_campaign: data.utmCampaign || null,
    utm_term: data.utmTerm || null,
    locale: "zh",
    source: "zh_intake",
    stage: "new",
    stage_changed_at: nowIso,
    user_agent: userAgent,
    consent_at: nowIso,
  };

  // Insert with a fresh lead_ref; on the (astronomically rare) unique
  // collision, try again with a new one.
  let leadId: string | null = null;
  let leadRef = "";
  for (let attempt = 0; attempt < 3 && !leadId; attempt++) {
    leadRef = generateLeadRef();
    const { data: inserted, error } = await svc
      .from("marketing_leads")
      .insert({ ...row, lead_ref: leadRef })
      .select("id")
      .single();
    if (!error && inserted) {
      leadId = inserted.id;
    } else if (error && error.code !== "23505") {
      reportError(error, "marketing:zh-intake:insert");
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
  }
  if (!leadId) {
    reportError(new Error("lead_ref collision after retries"), "marketing:zh-intake:insert");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  // Attachments — best-effort after the lead exists: a storage hiccup must not
  // lose the lead itself. Failures are reported and the admin sees the count.
  let uploaded = 0;
  for (const f of files) {
    const key = `${leadId}/${crypto.randomUUID()}.${EXT[f.type] ?? "bin"}`;
    const { error: upErr } = await svc.storage.from(BUCKET).upload(key, f, { contentType: f.type, upsert: false });
    if (upErr) {
      reportError(upErr, "marketing:zh-intake:upload");
      continue;
    }
    const { error: fileErr } = await svc.from("marketing_lead_files").insert({
      lead_id: leadId,
      storage_path: `${BUCKET}/${key}`,
      file_name: safeFileName(f.name),
      mime_type: f.type,
      size_bytes: f.size,
    });
    if (fileErr) reportError(fileErr, "marketing:zh-intake:file-row");
    else uploaded++;
  }

  console.info("[marketing:zh-intake] lead created", { leadRef, service: data.service, country: data.country, files: uploaded });

  after(async () => {
    await notifyRole(["admin"], {
      type: "system",
      title: "ลูกค้าจีนใหม่ (Chinese lead)",
      body: `${leadRef} · ${data.service} · ${data.country} · ${data.targetLocation}${uploaded ? ` · ${uploaded} ไฟล์` : ""}`,
      url: notificationLinks.leads(),
      priority: "high",
      line: true,
    });
  });

  return NextResponse.json({ ok: true, leadRef });
}
