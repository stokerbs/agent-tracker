import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyRole, notificationLinks } from "@/lib/notifications";
import { reportError } from "@/lib/errors";

// Public, unauthenticated endpoint — the marketing careers form posts here.
// Mirrors /api/marketing/lead (rate-limit → validate → honeypot → service-role
// insert → notify), for recruitment applications.
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  // Optional — validated as an email when provided; empty string is allowed.
  email: z.string().trim().max(120).email().optional().or(z.literal("")),
  position: z.string().trim().max(80).optional(),
  experience: z.string().trim().max(300).optional(),
  message: z.string().trim().max(1000).optional(),
  locale: z.enum(["th", "en"]).default("th"),
  // PDPA: explicit consent is required — must be exactly true, or the request
  // is rejected (400) before anything is stored.
  consent: z.literal(true),
  // Honeypot: real users never fill this hidden field; bots do. Accept any value
  // (bounded) so a filled one passes validation and hits the silent-success path.
  website: z.string().max(200).optional(),
});

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = await checkRateLimit("careers", ip);
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
  const { error } = await svc.from("recruitment_applications").insert({
    name: data.name,
    phone: data.phone,
    email: data.email ? data.email : null,
    position: data.position ?? null,
    experience: data.experience ?? null,
    message: data.message ?? null,
    locale: data.locale,
    source: "website",
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    consent_at: new Date().toISOString(),
  });

  if (error) {
    reportError(error, "marketing:careers:insert");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  // Notify admins of the new application (in-app + push), without blocking.
  after(async () => {
    await notifyRole(["admin"], {
      type: "system",
      title: "มีผู้สมัครร่วมงานใหม่",
      body: `${data.name} · ${data.phone}${data.position ? ` · ${data.position}` : ""}`,
      url: notificationLinks.recruitment(),
      priority: "high",
    });
  });

  return NextResponse.json({ ok: true });
}
