"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string } | undefined;

async function requestIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Normalises a Thai mobile number to E.164 (+66XXXXXXXXX).
 * Accepts: 0XXXXXXXXX | 66XXXXXXXXX | +66XXXXXXXXX (spaces/dashes stripped).
 * Thai mobile prefixes after country code: 6x, 7x, 8x, 9x (9 digits total).
 */
function normalizeThaiPhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s\-().]/g, "");

  let national: string;
  if (cleaned.startsWith("+66")) {
    national = cleaned.slice(3);
  } else if (cleaned.startsWith("66") && cleaned.length === 11) {
    national = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 10) {
    national = cleaned.slice(1);
  } else {
    return null;
  }

  if (!/^[6-9]\d{8}$/.test(national)) return null;
  return `+66${national}`;
}

/**
 * Step 1 of SMS OTP login: send a 6-digit code to the user's phone via SMS.
 * New users are automatically created (role='agent') via the handle_new_user trigger.
 * Rate-limited to 3 requests per IP per 5 minutes.
 */
export async function requestSmsOtp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ip = await requestIp();
  const rl = checkRateLimit("otp", ip);
  if (!rl.allowed) {
    const s = Math.ceil(rl.retryAfterMs / 1000);
    return { error: `Too many requests. Try again in ${s} second${s === 1 ? "" : "s"}.` };
  }

  const raw = String(formData.get("phone") ?? "").trim();
  const phone = normalizeThaiPhone(raw);
  if (!phone) {
    return { error: "Please enter a valid Thai mobile number (e.g. 081 234 5678)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error("[auth] signInWithOtp (sms) error:", error.code, error.status);
    if (error.status === 429) {
      return { error: "Too many requests. Please wait a moment before trying again." };
    }
    if (error.message?.toLowerCase().includes("sms")) {
      return { error: "SMS delivery failed. Please check your number and try again." };
    }
  }

  redirect(`/login/verify?phone=${encodeURIComponent(phone)}`);
}

/**
 * Portal variant of requestSmsOtp: sends OTP then redirects to the
 * portal-specific verify page (/portal/login/verify) instead of /login/verify.
 */
export async function requestPortalOtp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ip = await requestIp();
  const rl = checkRateLimit("otp", ip);
  if (!rl.allowed) {
    const s = Math.ceil(rl.retryAfterMs / 1000);
    return { error: `Too many requests. Try again in ${s} second${s === 1 ? "" : "s"}.` };
  }

  const raw = String(formData.get("phone") ?? "").trim();
  const phone = normalizeThaiPhone(raw);
  if (!phone) {
    return { error: "Please enter a valid Thai mobile number (e.g. 081 234 5678)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[auth] portal signInWithOtp error:", error.code, error.status);
    if (error.status === 429) {
      return { error: "Too many requests. Please wait a moment before trying again." };
    }
    if (error.message?.toLowerCase().includes("sms")) {
      return { error: "SMS delivery failed. Please check your number and try again." };
    }
    return { error: "Account not found. Please contact your case manager." };
  }

  redirect(`/portal/login/verify?phone=${encodeURIComponent(phone)}`);
}

/**
 * Step 2 of SMS OTP login: verify the 6-digit code and create a session.
 */
export async function verifyOtp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ip = await requestIp();
  const rl = checkRateLimit("otp_verify", ip);
  if (!rl.allowed) {
    const s = Math.ceil(rl.retryAfterMs / 1000);
    return { error: `Too many attempts. Try again in ${s} second${s === 1 ? "" : "s"}.` };
  }

  const raw = String(formData.get("phone") ?? "").trim();
  const phone = normalizeThaiPhone(raw);
  const token = String(formData.get("token") ?? "").replace(/\D/g, "").slice(0, 6);
  const rawNext = String(formData.get("next") ?? "/dashboard");
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/dashboard";

  if (!phone) {
    return { error: "Session expired. Please request a new code." };
  }
  if (token.length !== 6) {
    return { error: "Please enter the 6-digit code from your SMS." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error || !data.session) {
    return { error: "Invalid or expired code. Please try again or request a new one." };
  }

  try {
    const service = createServiceClient();
    await service.from("audit_logs").insert({
      actor_id: data.user?.id ?? null,
      action: "LOGIN",
      entity: "auth",
      entity_id: data.user?.id ?? null,
      metadata: { method: "otp_sms" },
      ip_address: ip === "unknown" ? null : ip,
    });
  } catch (auditErr) {
    console.error("[auth] audit log failed:", auditErr);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
