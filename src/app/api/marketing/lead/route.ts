import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyRole, notificationLinks } from "@/lib/notifications";
import { reportError } from "@/lib/errors";

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

  const { website, ...data } = parsed.data;
  // Honeypot tripped → pretend success, store nothing (don't tip off bots).
  if (website) return NextResponse.json({ ok: true });

  const svc = createServiceClient();
  const { error } = await svc.from("marketing_leads").insert({
    name: data.name,
    phone: data.phone,
    email: data.email ? data.email : null,
    case_type: data.caseType ?? null,
    message: data.message ?? null,
    locale: data.locale,
    source: "website",
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    consent_at: new Date().toISOString(),
  });

  if (error) {
    reportError(error, "marketing:lead:insert");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  // Notify admins of the new lead (in-app + push), without blocking the response.
  after(async () => {
    await notifyRole(["admin"], {
      type: "system",
      title: "ลูกค้าใหม่ติดต่อเข้ามา",
      body: `${data.name} · ${data.phone}${data.caseType ? ` · ${data.caseType}` : ""}`,
      url: notificationLinks.leads(),
      priority: "high",
      line: true,
    });
  });

  return NextResponse.json({ ok: true });
}
