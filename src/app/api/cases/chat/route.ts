import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";

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

/**
 * POST /api/cases/chat — ask AI about a case, answered ONLY from its data
 * (timeline + meta). Staff-only; reads with the user-session client so RLS
 * enforces case access. Rate-limited (ai_chat bucket).
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

  // Case meta (RLS-scoped → 404 if the caller can't access it).
  const { data: c } = await supabase
    .from("cases")
    .select("case_number, case_type, status, client_name")
    .eq("id", body.caseId)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const { data: rows } = await supabase
    .from("timeline_entries")
    .select("entry_date, entry_time, entry, location")
    .eq("case_id", body.caseId)
    .order("entry_date", { ascending: true })
    .order("entry_time", { ascending: true })
    .limit(400);

  const timeline = (rows ?? [])
    .map((e) => `${e.entry_date} ${String(e.entry_time).slice(0, 5)} — ${e.entry}${e.location ? ` [${e.location}]` : ""}`)
    .join("\n") || "(ไม่มีบันทึกไทม์ไลน์)";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: "ระบบ AI ยังไม่ได้ตั้งค่า (ไม่มี ANTHROPIC_API_KEY)" });
  }

  const system =
    `คุณเป็นผู้ช่วยนักวิเคราะห์คดีสืบสวน ตอบคำถามเกี่ยวกับ "คดีนี้" โดยอ้างอิงเฉพาะข้อมูลที่ให้ด้านล่างเท่านั้น ` +
    `(เมตาคดี + ไทม์ไลน์). ตอบเป็นภาษาไทย กระชับ ตรงประเด็น. ` +
    `ถ้าข้อมูลไม่พอจะตอบ ให้บอกตรงๆ ว่าไม่มีข้อมูลในบันทึก ห้ามเดาหรือแต่งข้อมูล. ` +
    `ถ้าอ้างถึงสถานที่ ให้แนบลิงก์ Google Maps ในรูปแบบ https://www.google.com/maps/search/?api=1&query=<ชื่อสถานที่>.\n\n` +
    `เมตาคดี: เลขคดี ${c.case_number} · ประเภท ${c.case_type ?? "-"} · สถานะ ${c.status} · ลูกค้า ${c.client_name ?? "-"}\n\n` +
    `ไทม์ไลน์:\n${timeline}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      signal: controller.signal,
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1000, system, messages: body.messages }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[case-chat] Anthropic error:", res.status);
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const reply = data.content?.[0]?.text?.trim() || "ขออภัย ไม่สามารถสร้างคำตอบได้";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[case-chat] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}
