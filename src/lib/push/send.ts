import "server-only";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { isApnsConfigured, sendApnsToTokens } from "./apns";
import type { PushPayload } from "./types";

/**
 * Firebase Cloud Messaging (HTTP v1) sender for native push.
 *
 * Auth uses a service-account JWT exchanged for an OAuth2 access token — no
 * extra npm dependency (Node `crypto` signs the RS256 assertion). Configure via
 * env: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY (PEM; literal "\n" is
 * normalised). When unset, all sends no-op so the app/web run unaffected.
 *
 * Delivery is split by platform in `sendPushToUsers`: iOS tokens go via APNs
 * (see ./apns), Android/web via FCM here.
 */

function fcmConfig() {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export function isPushConfigured(): boolean {
  return fcmConfig() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

let cachedToken: { token: string; exp: number } | null = null;

/** Mint (and cache) an OAuth2 access token for the FCM scope from the service account. */
async function getAccessToken(): Promise<string | null> {
  const cfg = fcmConfig();
  if (!cfg) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: cfg.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64url(
    crypto.createSign("RSA-SHA256").update(signingInput).sign(cfg.privateKey),
  );
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    console.error("[push] token exchange failed", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

/** Send to a single device token. Returns "ok" | "stale" | "error". */
async function sendToToken(
  projectId: string,
  accessToken: string,
  deviceToken: string,
  payload: PushPayload,
): Promise<"ok" | "stale" | "error"> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: payload.title, body: payload.body ?? "" },
          data: payload.link ? { link: payload.link } : {},
        },
      }),
    },
  );
  if (res.ok) return "ok";
  // 404 NOT_FOUND / 410 GONE → token no longer valid; caller prunes it.
  if (res.status === 404 || res.status === 410) return "stale";
  console.error("[push] send failed", res.status, await res.text());
  return "error";
}

/**
 * Fan a notification out to all device tokens of the given users, routing iOS
 * tokens to APNs and Android/web tokens to FCM. Fire-and-forget safe: no-ops
 * when neither transport is configured, prunes stale tokens, never throws.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  try {
    const fcm = fcmConfig();
    const apnsOn = isApnsConfigured();
    if ((!fcm && !apnsOn) || userIds.length === 0) return;

    const svc = createServiceClient();
    const { data: rows } = await svc
      .from("device_tokens")
      .select("token, platform")
      .in("profile_id", userIds);
    if (!rows || rows.length === 0) return;

    const iosTokens = rows.filter((r) => r.platform === "ios").map((r) => r.token as string);
    const otherTokens = rows.filter((r) => r.platform !== "ios").map((r) => r.token as string);

    const stale: string[] = [];

    // iOS → APNs (single HTTP/2 session for the batch).
    if (apnsOn && iosTokens.length > 0) {
      const results = await sendApnsToTokens(iosTokens, payload);
      stale.push(...results.filter((r) => r.status === "stale").map((r) => r.token));
    }

    // Android/web → FCM.
    if (fcm && otherTokens.length > 0) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        const results = await Promise.all(
          otherTokens.map(async (token) => ({
            token,
            status: await sendToToken(fcm.projectId, accessToken, token, payload),
          })),
        );
        const ok = results.filter((r) => r.status === "ok").length;
        const staleCount = results.filter((r) => r.status === "stale").length;
        const error = results.filter((r) => r.status === "error").length;
        console.log(`[delivery] fcm sent=${ok} stale=${staleCount} error=${error} total=${results.length}`);
        stale.push(...results.filter((r) => r.status === "stale").map((r) => r.token));
      }
    }

    if (stale.length > 0) {
      await svc.from("device_tokens").delete().in("token", stale);
      console.log(`[token] pruned ${stale.length} stale device token(s)`);
    }
  } catch (err) {
    console.error("[push] sendPushToUsers error", err);
  }
}
