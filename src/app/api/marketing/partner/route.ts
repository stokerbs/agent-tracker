import { NextResponse, type NextRequest, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyRole, notificationLinks } from "@/lib/notifications";
import { reportError } from "@/lib/errors";
import { zhPartnerSchema, generateReferralSlug } from "@/lib/marketing/zh/partner-schema";

/**
 * Public, unauthenticated endpoint — the /zh/partners application form posts
 * JSON here. Same shape as /api/marketing/lead: rate-limit → honeypot → zod →
 * service-role insert (with a unique referral slug) → notify admins. The
 * referral slug is NOT returned: admins hand it out once an agreement exists.
 */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rejected(reason: string, ip: string, status: number) {
  console.warn("[marketing:partner] rejected", { reason, ip });
  return NextResponse.json({ ok: false, error: reason }, { status });
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = await checkRateLimit("partner", ip);
  if (!rl.allowed) {
    console.warn("[marketing:partner] rejected", { reason: "rate_limited", ip });
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rejected("invalid_json", ip, 400);
  }

  // Honeypot before validation — a bot never learns whether the rest would pass.
  const hp = (body as { website?: unknown } | null)?.website;
  if (typeof hp === "string" && hp.length > 0) {
    console.warn("[marketing:partner] rejected", { reason: "honeypot", ip });
    return NextResponse.json({ ok: true });
  }

  const parsed = zhPartnerSchema.safeParse(body);
  if (!parsed.success) return rejected("invalid_input", ip, 400);
  const { website: _hp, ...d } = parsed.data;

  const svc = createServiceClient();
  const nowIso = new Date().toISOString();
  let inserted = false;
  let slug = "";
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    slug = generateReferralSlug(d.orgName);
    const { error } = await svc.from("marketing_partners").insert({
      org_name: d.orgName,
      partner_type: d.partnerType,
      contact_name: d.contactName,
      wechat_id: d.wechatId || null,
      email: d.email || null,
      phone: d.phone || null,
      city: d.city || null,
      country: d.country,
      org_website: d.orgWebsite || null,
      services: d.services,
      expected_volume: d.expectedVolume,
      message: d.message || null,
      locale: "zh",
      source: "website",
      referral_slug: slug,
      stage: "new",
      stage_changed_at: nowIso,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      consent_at: nowIso,
    });
    if (!error) inserted = true;
    else if (error.code !== "23505") {
      reportError(error, "marketing:partner:insert");
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
  }
  if (!inserted) {
    reportError(new Error("referral slug collision after retries"), "marketing:partner:insert");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  console.info("[marketing:partner] application created", { partnerType: d.partnerType, country: d.country, services: d.services.length });

  after(async () => {
    await notifyRole(["admin"], {
      type: "system",
      title: "พาร์ทเนอร์ B2B สมัครใหม่ (Chinese partner)",
      body: `${d.partnerType} · ${d.country} · ${d.services.length} บริการ`,
      url: notificationLinks.partners(),
      priority: "normal",
      line: true,
    });
  });

  return NextResponse.json({ ok: true });
}
