/**
 * In-memory sliding-window rate limiter.
 *
 * The store is a module-level Map, so state persists across requests within
 * one Node.js process. This is correct for single-instance deployments (local,
 * single server, single Vercel region with one replica).
 *
 * For multi-instance deployments (horizontally scaled, multiple Vercel
 * replicas, etc.) replace checkRateLimit() with a Redis-backed implementation
 * that shares state across instances — e.g. @upstash/ratelimit — while keeping
 * the same call signature and return type.
 */

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
} as const;

type Bucket = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window. 0 when not allowed. */
  remaining: number;
  /** Milliseconds until the oldest slot expires and a new request is allowed. */
  retryAfterMs: number;
}

// Hit-timestamp store: "bucket:identifier" → sorted array of timestamps (ms).
const store = new Map<string, number[]>();

// Periodic sweep: evicts inactive keys to prevent unbounded Map growth.
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

/**
 * Check and record a request against the named rate-limit bucket.
 *
 * @param bucket  - One of the keys in RATE_LIMITS.
 * @param identifier - Opaque string identifying the requester (IP or user ID).
 */
export function checkRateLimit(
  bucket: Bucket,
  identifier: string,
): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `${bucket}:${identifier}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  // Lazy prune: drop timestamps outside the current window.
  const ts = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (ts.length >= limit) {
    store.set(key, ts);
    scheduleSweep();
    // ts[0] is the oldest hit; when it expires a new slot opens.
    return { allowed: false, remaining: 0, retryAfterMs: ts[0] + windowMs - now };
  }

  ts.push(now);
  store.set(key, ts);
  scheduleSweep();

  return { allowed: true, remaining: limit - ts.length, retryAfterMs: 0 };
}
