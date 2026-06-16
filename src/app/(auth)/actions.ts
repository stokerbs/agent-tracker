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

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Step 1 of OTP login: send a 6-digit code to the user's email.
 * New users are automatically created (role='agent') via the handle_new_user trigger.
 * We never reveal whether the email belongs to an existing account.
 */
export async function requestOtp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ip = await requestIp();
  const rl = checkRateLimit("otp", ip);
  if (!rl.allowed) {
    const s = Math.ceil(rl.retryAfterMs / 1000);
    return { error: `Too many requests. Try again in ${s} second${s === 1 ? "" : "s"}.` };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    // Log internally but don't expose details to prevent email enumeration.
    console.error("[auth] signInWithOtp error:", error.code, error.status);
    // Still redirect — Supabase may return an error for rate limits on their side.
    if (error.status === 429) {
      return { error: "Too many requests. Please wait a moment before trying again." };
    }
  }

  // Always redirect regardless of whether the email exists; the code page
  // simply says "if we have an account for this email, a code was sent."
  redirect(`/login/verify?email=${encodeURIComponent(email)}`);
}

/**
 * Step 2 of OTP login: verify the 6-digit code and create a session.
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

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\D/g, "").slice(0, 6);
  const rawNext = String(formData.get("next") ?? "/dashboard");
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/dashboard";

  if (!isValidEmail(email)) {
    return { error: "Session expired. Please request a new code." };
  }
  if (token.length !== 6) {
    return { error: "Please enter the 6-digit code from your email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error || !data.session) {
    return { error: "Invalid or expired code. Please try again or request a new one." };
  }

  // Write audit log (non-fatal — use service client to bypass RLS).
  try {
    const service = createServiceClient();
    await service.from("audit_logs").insert({
      actor_id: data.user?.id ?? null,
      action: "LOGIN",
      entity: "auth",
      entity_id: data.user?.id ?? null,
      metadata: { method: "otp_email" },
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
