import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyRole, notificationLinks } from "@/lib/notifications";
import { reportError } from "@/lib/errors";
import { generateLeadRef } from "@/lib/marketing/zh/lead-ref";
import { attributionSchema, attributionColumns } from "@/lib/marketing/lead-attribution";

// Public, unauthenticated endpoint — the marketing site's contact form posts here.
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  // Optional — validated as an email when provided; empty string is allowed.
  email: z.string().trim().max(120).email().optional().or(z.literal("")),
  caseType: z.string().trim().max(60).optional(),
  message: z.string().trim().max(1000).optional(),
  locale: z.enum(["th", "en", "zh"]).default("th"),
  // PDPA: explicit consent is required — must be exactly true, or the request
  // is rejected (400) before anything is stored.
  consent: z.literal(true),
  attribution: attributionSchema,
  // Honeypot: real users never fill this hidden field; bots do. Accept any value
  // (bounded) so a filled one passes validation and hits the silent-success path
  // below (we don't want to signal to bots that they were detected).
  website: z.string().max(200).optional(),
});

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = await checkRateLimit("lead", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const { website, attribution, ...data } = parsed.data;
  const prefix = data.locale === "en" ? "EN" : data.locale === "zh" ? "CN" : "TH";
  // Honeypot tripped → pretend success with the same response shape as a real
  // submission (a throw-away ref), store nothing — don't tip off bots.
  if (website) return NextResponse.json({ ok: true, leadRef: generateLeadRef(new Date(), Math.random, prefix) });

  const nowIso = new Date().toISOString();
  const row = {
    name: data.name,
    phone: data.phone,
    email: data.email ? data.email : null,
    case_type: data.caseType ?? null,
    message: data.message ?? null,
    locale: data.locale,
    source: "website",
    stage: "new",
    stage_changed_at: nowIso,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    consent_at: nowIso,
    ...attributionColumns(attribution),
  };

  const svc = createServiceClient();
  // Insert with a fresh lead_ref; on the (astronomically rare) unique
  // collision (23505) try again with a new one.
  let leadRef = "";
  let inserted = false;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    leadRef = generateLeadRef(new Date(), Math.random, prefix);
    const { error } = await svc.from("marketing_leads").insert({ ...row, lead_ref: leadRef });
    if (!error) {
      inserted = true;
    } else if (error.code !== "23505") {
      reportError(error, "marketing:lead:insert");
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
  }
  if (!inserted) {
    reportError(new Error("lead_ref collision after 3 attempts"), "marketing:lead:insert");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  // Notify admins of the new lead (in-app + push), without blocking the response.
  after(async () => {
    await notifyRole(["admin"], {
      type: "system",
      title: "ลูกค้าใหม่ติดต่อเข้ามา",
      body: `${data.name} · ${data.phone}${data.caseType ? ` · ${data.caseType}` : ""} · ${leadRef}`,
      url: notificationLinks.leads(),
      priority: "high",
      line: true,
    });
  });

  return NextResponse.json({ ok: true, leadRef });
}
