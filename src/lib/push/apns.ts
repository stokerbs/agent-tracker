import "server-only";
import crypto from "node:crypto";
import http2 from "node:http2";
import { apnsPriority, notificationData, type PushPayload, type SendStatus } from "./types";
import { reportError } from "@/lib/errors";

/**
 * Apple Push Notification service (APNs) sender — used for iOS device tokens,
 * which the `@capacitor/push-notifications` plugin returns as raw APNs tokens
 * (not FCM tokens). Sending them straight to APNs avoids putting the Firebase
 * SDK in the iOS app.
 *
 * Auth is a provider JWT signed with the APNs Auth Key (.p8, an EC P-256 key)
 * using ES256 — Node `crypto` signs it, no extra dependency. APNs requires
 * HTTP/2, which `fetch`/undici can't do as a client, so this uses `node:http2`.
 *
 * Configure via env (all required, else every send no-ops):
 *   APNS_KEY_ID       — the .p8 key's Key ID
 *   APNS_TEAM_ID      — Apple Developer Team ID
 *   APNS_BUNDLE_ID    — app bundle id, used as the apns-topic (e.g. app.detectivepulse.field)
 *   APNS_PRIVATE_KEY  — the .p8 PEM contents (literal "\n" is normalised)
 *   APNS_PRODUCTION   — "false" routes to the sandbox host; anything else (default) is production
 *
 * Reliability: failed sends are classified (ok / stale / error) and transient
 * failures are retried once on the same HTTP/2 session — an expired provider
 * JWT (403 ExpiredProviderToken) refreshes the token; rate-limit/5xx/network
 * errors back off briefly. "stale" tokens (410 / Unregistered / BadDeviceToken)
 * are surfaced so the caller prunes them. Never throws.
 */

interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  host: string;
}

function apnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !bundleId || !privateKey) return null;
  // TestFlight / App Store builds use the production gateway; Xcode dev builds the sandbox.
  const host =
    process.env.APNS_PRODUCTION === "false"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
  return { keyId, teamId, bundleId, privateKey, host };
}

export function isApnsConfigured(): boolean {
  return apnsConfig() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// APNs allows reusing a provider token for up to 1h (and rejects regenerating
// too frequently). Cache and refresh well inside the window; `force` busts the
// cache after an ExpiredProviderToken rejection.
let cachedJwt: { token: string; iat: number } | null = null;

function providerToken(cfg: ApnsConfig, force = false): string {
  const now = Math.floor(Date.now() / 1000);
  if (!force && cachedJwt && now - cachedJwt.iat < 50 * 60) return cachedJwt.token;

  const header = base64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = base64url(JSON.stringify({ iss: cfg.teamId, iat: now }));
  const signingInput = `${header}.${claims}`;
  // ES256/JOSE needs the raw r||s signature, not Node's default DER encoding.
  const signature = crypto.sign("SHA256", Buffer.from(signingInput), {
    key: cfg.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token, iat: now };
  return token;
}

/** Per-send outcome; `retry` asks the batch to retry this token (refresh JWT or back off). */
type Outcome = { token: string; status: SendStatus; retry: "jwt" | "backoff" | null };

/** Send one notification over an open HTTP/2 session. Never rejects. */
function sendOne(
  client: http2.ClientHttp2Session,
  jwt: string,
  bundleId: string,
  deviceToken: string,
  body: string,
  priority: "10" | "5",
): Promise<Outcome> {
  return new Promise((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": priority,
      "content-type": "application/json",
    });

    let status = 0;
    let data = "";
    req.setEncoding("utf8");
    req.setTimeout(10_000, () => req.close(http2.constants.NGHTTP2_CANCEL));
    req.on("response", (headers) => {
      status = Number(headers[":status"]) || 0;
    });
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("error", (err) => {
      reportError(err, "apns:request");
      // Network/stream failure — retry once with a short backoff.
      resolve({ token: deviceToken, status: "error", retry: "backoff" });
    });
    req.on("end", () => {
      if (status === 200) return resolve({ token: deviceToken, status: "ok", retry: null });
      let reason = "";
      try {
        reason = (JSON.parse(data) as { reason?: string }).reason ?? "";
      } catch {
        // non-JSON body
      }
      // Token no longer deliverable → caller prunes it.
      if (
        status === 410 ||
        reason === "Unregistered" ||
        reason === "BadDeviceToken" ||
        reason === "DeviceTokenNotForTopic"
      ) {
        return resolve({ token: deviceToken, status: "stale", retry: null });
      }
      // Provider JWT expired → refresh it and retry.
      if (status === 403 && reason === "ExpiredProviderToken") {
        return resolve({ token: deviceToken, status: "error", retry: "jwt" });
      }
      // Rate limited / APNs server error → back off and retry once.
      if (status === 429 || status >= 500) {
        return resolve({ token: deviceToken, status: "error", retry: "backoff" });
      }
      // Non-retryable config/auth errors (InvalidProviderToken, MissingTopic, …).
      console.error("[apns] send failed", status, reason || data);
      resolve({ token: deviceToken, status: "error", retry: null });
    });

    req.end(body);
  });
}

/**
 * Send a notification to many iOS device tokens over a single HTTP/2 session.
 * Returns a per-token status (so the caller can prune "stale" tokens). No-ops to
 * an empty array when APNs isn't configured. Never throws.
 */
export async function sendApnsToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<{ token: string; status: SendStatus }[]> {
  const cfg = apnsConfig();
  if (!cfg || tokens.length === 0) return [];

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body ?? "" },
      sound: "default",
    },
    ...notificationData(payload),
  });
  const priority = apnsPriority(payload.priority);

  const client = http2.connect(cfg.host);
  // A session-level error (e.g. connect failure) would otherwise leave the
  // per-request promises unsettled — fail the whole batch instead of hanging.
  const sessionError = new Promise<{ token: string; status: SendStatus }[]>((resolve) => {
    client.on("error", (err) => {
      reportError(err, "apns:session");
      resolve(tokens.map((token) => ({ token, status: "error" as SendStatus })));
    });
  });

  const run = async (): Promise<{ token: string; status: SendStatus }[]> => {
    let jwt = providerToken(cfg);
    const first = await Promise.all(
      tokens.map((t) => sendOne(client, jwt, cfg.bundleId, t, body, priority)),
    );

    const final: { token: string; status: SendStatus }[] = [];
    const jwtRetry: string[] = [];
    const backoffRetry: string[] = [];
    for (const o of first) {
      if (o.retry === "jwt") jwtRetry.push(o.token);
      else if (o.retry === "backoff") backoffRetry.push(o.token);
      else final.push({ token: o.token, status: o.status });
    }

    if (jwtRetry.length > 0 || backoffRetry.length > 0) {
      if (jwtRetry.length > 0) jwt = providerToken(cfg, true); // refresh expired JWT
      if (backoffRetry.length > 0) await sleep(500);
      const retryTokens = [...jwtRetry, ...backoffRetry];
      const retried = await Promise.all(
        retryTokens.map((t) => sendOne(client, jwt, cfg.bundleId, t, body, priority)),
      );
      for (const o of retried) final.push({ token: o.token, status: o.status });
    }
    return final;
  };

  try {
    const results = await Promise.race([run(), sessionError]);
    const ok = results.filter((r) => r.status === "ok").length;
    const stale = results.filter((r) => r.status === "stale").length;
    const error = results.filter((r) => r.status === "error").length;
    console.log(`[delivery] apns sent=${ok} stale=${stale} error=${error} total=${results.length}`);
    return results;
  } catch (err) {
    reportError(err, "apns:batch");
    return tokens.map((token) => ({ token, status: "error" as SendStatus }));
  } finally {
    client.close();
  }
}
