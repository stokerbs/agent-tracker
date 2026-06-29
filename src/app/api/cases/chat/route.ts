import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { decryptField } from "@/lib/security/encryption";
import { BUCKETS } from "@/lib/constants";
import { buildIntelText, type TargetIntel } from "@/lib/cases/chat-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // vision requests + image fetches take longer

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";

// Vision budget — images are re-sent each turn, so cap hard to bound cost/size.
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // skip anything larger than 4MB

const schema = z.object({
  caseId: z.string().uuid(),
  messages: z
    .array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    }))
    .min(1)
    .max(20),
});

const dec = (v: string | null | undefined): string | null => (v ? decryptField(v) : null);

type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function mediaTypeFor(path: string, fallback: string | null): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return fallback && fallback.startsWith("image/") ? fallback : "image/jpeg";
}

/**
 * POST /api/cases/chat — ask AI about a case. Answers from the case's own data:
 * meta + timeline + decrypted target intelligence + the case's images (evidence
 * photos, target/vehicle photos) sent to Claude vision. Staff-only; every read
 * uses the user-session client so RLS scopes exactly what the caller can access.
 * Rate-limited (ai_chat bucket).
 */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const rl = await checkRateLimit("ai_chat", profile.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();

  // Case meta + target identity (RLS-scoped → 404 if the caller can't access it).
  const { data: c } = await supabase
    .from("cases")
    .select("case_number, case_type, status, client_name, target_name_enc, target_alias_enc, target_phone_enc, target_email_enc, target_dob_enc, target_notes_enc")
    .eq("id", body.caseId)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  // Timeline + target intelligence tables (all RLS-scoped).
  const [rowsRes, locRes, vehRes, relRes] = await Promise.all([
    supabase.from("timeline_entries").select("entry_date, entry_time, entry, location")
      .eq("case_id", body.caseId).order("entry_date", { ascending: true }).order("entry_time", { ascending: true }).limit(400),
    supabase.from("target_locations").select("location_name, label, location_type, address_enc, notes, lat, lng").eq("case_id", body.caseId),
    supabase.from("target_vehicles").select("make, model, color, license_plate_enc, notes").eq("case_id", body.caseId),
    supabase.from("target_relationships").select("name_enc, relation, notes").eq("case_id", body.caseId),
  ]);

  const timeline = (rowsRes.data ?? [])
    .map((e) => `${e.entry_date} ${String(e.entry_time).slice(0, 5)} — ${e.entry}${e.location ? ` [${e.location}]` : ""}`)
    .join("\n") || "(ไม่มีบันทึกไทม์ไลน์)";

  const intel: TargetIntel = {
    name: dec(c.target_name_enc), alias: dec(c.target_alias_enc), phone: dec(c.target_phone_enc),
    email: dec(c.target_email_enc), dob: dec(c.target_dob_enc), notes: dec(c.target_notes_enc),
    locations: (locRes.data ?? []).map((l) => ({
      name: l.location_name ?? l.label ?? dec(l.address_enc) ?? "—",
      type: l.location_type ?? null, address: dec(l.address_enc), notes: l.notes, lat: l.lat, lng: l.lng,
    })),
    vehicles: (vehRes.data ?? []).map((v) => ({
      label: [v.make, v.model, v.color].filter(Boolean).join(" ") || "ยานพาหนะ",
      plate: dec(v.license_plate_enc), notes: v.notes,
    })),
    relationships: (relRes.data ?? []).map((r) => ({ name: dec(r.name_enc), relation: r.relation ?? null, notes: r.notes })),
  };
  const intelText = buildIntelText(intel);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: "ระบบ AI ยังไม่ได้ตั้งค่า (ไม่มี ANTHROPIC_API_KEY)" });
  }

  // Collect the case's images: target/vehicle photos (intelligence bucket) +
  // image-type evidence (evidence bucket). RLS already scoped the rows.
  const images = await loadCaseImages(supabase, body.caseId);

  const system =
    `คุณเป็นผู้ช่วยนักวิเคราะห์คดีสืบสวน ตอบคำถามเกี่ยวกับ "คดีนี้" โดยอ้างอิงเฉพาะข้อมูลที่ให้ ` +
    `(เมตาคดี + ไทม์ไลน์ + ข่าวกรองเป้าหมาย + ภาพในคดีที่แนบมา). ตอบเป็นภาษาไทย กระชับ ตรงประเด็น. ` +
    `ถ้าข้อมูลไม่พอจะตอบ ให้บอกตรงๆ ว่าไม่มีข้อมูลในคดี ห้ามเดาหรือแต่งข้อมูล. ` +
    `เมื่ออ้างถึงภาพ ให้ระบุสิ่งที่เห็นจริง (รถ/ป้ายทะเบียน/บุคคล/สถานที่) อย่างระมัดระวัง อย่ายืนยันตัวตนเกินกว่าที่เห็น. ` +
    `ถ้าอ้างถึงสถานที่ ให้แนบลิงก์ Google Maps (ใช้ลิงก์ที่ให้มาในข่าวกรองตามจริง หรือรูปแบบ https://www.google.com/maps/search/?api=1&query=<ชื่อสถานที่>).\n\n` +
    `เมตาคดี: เลขคดี ${c.case_number} · ประเภท ${c.case_type ?? "-"} · สถานะ ${c.status} · ลูกค้า ${c.client_name ?? "-"}\n\n` +
    (intelText ? intelText + "\n\n" : "") +
    `ไทม์ไลน์:\n${timeline}`;

  // Prime the conversation with the case images (once), then the real Q&A.
  const messages = images.length
    ? [
        { role: "user" as const, content: [...images, { type: "text" as const, text: `ภาพในคดี ${images.length} รูป (ใช้ประกอบการวิเคราะห์)` }] },
        { role: "assistant" as const, content: "รับทราบ ดูภาพในคดีแล้ว พร้อมช่วยวิเคราะห์" },
        ...body.messages,
      ]
    : body.messages;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      signal: controller.signal,
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1500, system, messages }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[case-chat] Anthropic error:", res.status);
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const reply = data.content?.[0]?.text?.trim() || "ขออภัย ไม่สามารถสร้างคำตอบได้";
    return NextResponse.json({ reply, images: images.length });
  } catch (e) {
    console.error("[case-chat] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}

/**
 * Sign + fetch the case's images and return Anthropic vision blocks (base64),
 * capped at MAX_IMAGES and skipping anything over MAX_IMAGE_BYTES. Best-effort:
 * a failure to load any single image is logged and skipped, never thrown.
 */
async function loadCaseImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
): Promise<ImageBlock[]> {
  try {
    const [photosRes, vehPhotosRes, evRes] = await Promise.all([
      supabase.from("target_photos").select("storage_path").eq("case_id", caseId).limit(MAX_IMAGES),
      supabase.from("vehicle_photos").select("storage_path").eq("case_id", caseId).limit(MAX_IMAGES),
      supabase.from("evidence").select("storage_path, mime_type").eq("case_id", caseId).like("mime_type", "image/%").limit(MAX_IMAGES),
    ]);

    const intel: Array<{ path: string; mime: string | null }> = [
      ...((photosRes.data ?? []) as { storage_path: string }[]).map((p) => ({ path: p.storage_path, mime: null })),
      ...((vehPhotosRes.data ?? []) as { storage_path: string }[]).map((p) => ({ path: p.storage_path, mime: null })),
    ];
    const evidence = ((evRes.data ?? []) as { storage_path: string; mime_type: string | null }[])
      .map((e) => ({ path: e.storage_path, mime: e.mime_type }));

    // Sign per bucket.
    const sign = async (bucket: string, paths: string[]) => {
      if (!paths.length) return {} as Record<string, string>;
      const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 600);
      const map: Record<string, string> = {};
      (data ?? []).forEach((s, i) => { if (s.signedUrl) map[paths[i]] = s.signedUrl; });
      return map;
    };
    const [intelSigned, evSigned] = await Promise.all([
      sign(BUCKETS.intelligence, intel.map((i) => i.path)),
      sign(BUCKETS.evidence, evidence.map((e) => e.path)),
    ]);

    const candidates = [
      ...intel.map((i) => ({ url: intelSigned[i.path], path: i.path, mime: i.mime })),
      ...evidence.map((e) => ({ url: evSigned[e.path], path: e.path, mime: e.mime })),
    ].filter((x) => x.url).slice(0, MAX_IMAGES);

    const blocks: ImageBlock[] = [];
    for (const cand of candidates) {
      try {
        const r = await fetch(cand.url);
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) continue;
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: mediaTypeFor(cand.path, cand.mime), data: buf.toString("base64") },
        });
      } catch (err) {
        console.error("[case-chat] image fetch skipped:", err instanceof Error ? err.message : err);
      }
    }
    return blocks;
  } catch (e) {
    console.error("[case-chat] loadCaseImages failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
