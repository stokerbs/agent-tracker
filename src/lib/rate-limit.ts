/**
 * Sliding-window rate limiter.
 *
 * Uses Upstash Redis when configured (UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN) so the window is shared across every serverless
 * instance/region — correct for Vercel, where each instance otherwise has its
 * own memory. Without those env vars it falls back to an in-process Map, which
 * is correct only for a single instance (local / single replica) but keeps the
 * app working with no external dependency.
 *
 * checkRateLimit() is async (Redis is async); the return type is unchanged.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const RATE_LIMITS = {
  /** 10 sign-in attempts per minute per IP (legacy password flow). */
  login:      { limit: 10, windowMs:     60_000 },
  /** 5 registrations per minute per IP (legacy). */
  register:   { limit:  5, windowMs:     60_000 },
  /** 3 OTP send requests per 5 minutes per IP — prevents email spam. */
  otp:        { limit:  3, windowMs:  5 * 60_000 },
  /** 5 OTP verification attempts per 5 minutes per IP — brute-force guard. */
  otp_verify: { limit:  5, windowMs:  5 * 60_000 },
  /** 5 app-lock PIN attempts per 5 minutes per user — then fall back to OTP. */
  pin_verify: { limit:  5, windowMs:  5 * 60_000 },
  /** 60 GPS pings per minute per authenticated user (≈ 1 per second). */
  gps:        { limit: 60, windowMs:     60_000 },
  /** 5 AI report generations per hour per authenticated user. */
  report:     { limit:  5, windowMs: 3_600_000 },
  /** 40 AI case-chat messages per hour per authenticated user. */
  ai_chat:    { limit: 40, windowMs: 3_600_000 },
  /** 30 GPS route-replay history fetches per hour per user — bounds live GPS903 calls. */
  gps_history:{ limit: 30, windowMs: 3_600_000 },
  /** 5 public marketing lead submissions per hour per IP — anti-spam. */
  lead:       { limit:  5, windowMs: 3_600_000 },
  /** 5 public recruitment applications per hour per IP — anti-spam. */
  careers:    { limit:  5, windowMs: 3_600_000 },
  /** 30 public AI-assistant messages per hour per IP — cost + abuse guard. */
  assistant:  { limit: 30, windowMs: 3_600_000 },
  /** 20 OSINT image analyses per hour per user — bounds outbound fetches + AI cost. */
  osint_analyze: { limit: 20, windowMs: 3_600_000 },
} as const;

type Bucket = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window. 0 when not allowed. */
  remaining: number;
  /** Milliseconds until the oldest slot expires and a new request is allowed. */
  retryAfterMs: number;
}

// ── Upstash Redis backend (preferred; gated on env) ─────────────────────────
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash    = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

let redis: Redis | null = null;
const limiters = new Map<Bucket, Ratelimit>();

function getLimiter(bucket: Bucket): Ratelimit {
  redis ??= new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! });
  let rl = limiters.get(bucket);
  if (!rl) {
    const { limit, windowMs } = RATE_LIMITS[bucket];
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `rl:${bucket}`,
      analytics: false,
    });
    limiters.set(bucket, rl);
  }
  return rl;
}

// ── In-process fallback (single-instance only) ──────────────────────────────
// Hit-timestamp store: "bucket:identifier" → sorted array of timestamps (ms).
const store = new Map<string, number[]>();

const SWEEP_INTERVAL_MS = Math.max(
  ...Object.values(RATE_LIMITS).map((r) => r.windowMs),
);
let sweepTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSweep() {
  if (sweepTimer !== null) return;
  sweepTimer = setTimeout(() => {
    const cutoff = Date.now() - SWEEP_INTERVAL_MS;
    for (const [key, ts] of store) {
      const fresh = ts.filter((t) => t > cutoff);
      fresh.length === 0 ? store.delete(key) : store.set(key, fresh);
    }
    sweepTimer = null;
  }, SWEEP_INTERVAL_MS);
}

function checkInMemory(bucket: Bucket, identifier: string): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `${bucket}:${identifier}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const ts = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (ts.length >= limit) {
    store.set(key, ts);
    scheduleSweep();
    return { allowed: false, remaining: 0, retryAfterMs: ts[0] + windowMs - now };
  }

  ts.push(now);
  store.set(key, ts);
  scheduleSweep();

  return { allowed: true, remaining: limit - ts.length, retryAfterMs: 0 };
}

/**
 * Check and record a request against the named rate-limit bucket.
 *
 * @param bucket     - One of the keys in RATE_LIMITS.
 * @param identifier - Opaque string identifying the requester (IP or user ID).
 */
export async function checkRateLimit(
  bucket: Bucket,
  identifier: string,
): Promise<RateLimitResult> {
  if (!useUpstash) return checkInMemory(bucket, identifier);
  try {
    const r = await getLimiter(bucket).limit(identifier);
    return {
      allowed: r.success,
      remaining: r.remaining,
      retryAfterMs: r.success ? 0 : Math.max(0, r.reset - Date.now()),
    };
  } catch {
    // Redis unreachable — fail over to in-memory so auth/GPS isn't bricked by a
    // transient Upstash outage (degrades to per-instance limiting, not open).
    return checkInMemory(bucket, identifier);
  }
}
