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
  return { ok: true };
}
