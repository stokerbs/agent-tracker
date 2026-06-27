"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPin, verifyPinHash } from "@/lib/security/pin";

/**
 * App-lock PIN actions. The PIN hash lives in `user_pins` (service-role only),
 * so it never reaches the client. Identity is enforced via getCurrentProfile;
 * verify is rate-limited so a lost device can't be brute-forced.
 */

const PIN_RE = /^\d{4,6}$/;

export async function setPin(pin: string): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!PIN_RE.test(pin)) return { error: "PIN must be 4–6 digits." };

  const svc = createServiceClient();
  const { error } = await svc
    .from("user_pins")
    .upsert({ profile_id: profile.id, pin_hash: hashPin(pin), updated_at: new Date().toISOString() });
  if (error) return { error: "Could not save your PIN. Please try again." };

  revalidatePath("/settings/profile");
  return { ok: true };
}

export async function disablePin(): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  const svc = createServiceClient();
  await svc.from("user_pins").delete().eq("profile_id", profile.id);
  revalidatePath("/settings/profile");
  return { ok: true };
}

/** Verify the PIN to unlock the app. Rate-limited; `locked` means fall back to OTP. */
export async function verifyPin(
  pin: string,
): Promise<{ ok: true } | { error: string; locked?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated", locked: true };

  const rl = checkRateLimit("pin_verify", profile.id);
  if (!rl.allowed) {
    return { error: "Too many attempts. Please sign in with a code.", locked: true };
  }

  const svc = createServiceClient();
  const { data } = await svc
    .from("user_pins")
    .select("pin_hash")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!data?.pin_hash) return { error: "No PIN is set." };

  if (!verifyPinHash(pin, data.pin_hash)) return { error: "Incorrect PIN." };
  return { ok: true };
}
