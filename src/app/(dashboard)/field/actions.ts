"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { handleDbError } from "@/lib/errors";

/**
 * Persist a native push token for the current user's device.
 *
 * Tokens are globally unique; re-registering the same device upserts and
 * re-points the token at the current user (e.g. after a different agent logs in
 * on the same phone). Verifies the session via the cookie client, then writes
 * with the service client (mirrors /api/agents/location).
 */
export async function registerDeviceToken(
  token: string,
  platform: string,
): Promise<{ ok: true } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!token || token.length < 8) return { error: "Invalid token" };

  const svc = createServiceClient();
  const { error } = await svc
    .from("device_tokens")
    .upsert(
      {
        profile_id: profile.id,
        platform: platform === "ios" || platform === "android" ? platform : "web",
        token,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
  if (error) return { error: handleDbError(error, "registerDeviceToken") };
  // [token] stored — log the platform + token LENGTH only, never the token value.
  console.log(`[token] stored platform=${platform} len=${token.length} profile=${profile.id}`);
  return { ok: true };
}

/**
 * Remove a single device's push token on logout, so a signed-out phone stops
 * receiving the previous user's notifications. Scoped to the caller's own
 * profile (you can only remove a token currently registered to you). No-ops if
 * the token isn't yours / doesn't exist. Logs length only, never the value.
 */
export async function unregisterDeviceToken(token: string): Promise<{ ok: true }> {
  const profile = await getCurrentProfile();
  if (!profile || !token) return { ok: true };
  const svc = createServiceClient();
  await svc.from("device_tokens").delete().eq("token", token).eq("profile_id", profile.id);
  console.log(`[token] removed len=${token.length} profile=${profile.id}`);
  return { ok: true };
}

/**
 * Mint a long-lived GPS token for the current user's device, used by the native
 * background-geolocation watcher to authenticate location posts when the WebView
 * session is unavailable. Replaces any prior token (one active per user). The
 * native layer stores this securely and sends it as `Authorization: Bearer`.
 */
export async function issueGpsToken(): Promise<{ ok: true; token: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };

  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const svc = createServiceClient();
  await svc.from("gps_tokens").delete().eq("profile_id", profile.id);
  const { error } = await svc
    .from("gps_tokens")
    .insert({ profile_id: profile.id, token });
  if (error) return { error: handleDbError(error, "issueGpsToken") };
  return { ok: true, token };
}

/**
 * Server-visible diagnostic for native push activation. Logs to the server
 * (Vercel) console only — no DB write and no auth gate, so it records every
 * stage even before/without a session. Used to trace where iOS push
 * registration stops when public.device_tokens stays empty. It never receives
 * the device token value (callers pass its length only). Safe to remove once
 * activation is confirmed.
 */
export async function logNativePushEvent(stage: string, detail?: string): Promise<void> {
  const safe = (detail ?? "").slice(0, 300);
  console.log(`[native-push] ${stage}${safe ? " :: " + safe : ""}`);
}
