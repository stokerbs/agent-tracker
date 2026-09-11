/**
 * Transient-failure retry for long offline Studio jobs (consolidation, bulk
 * import). Pure and dependency-free so both lib code and tests use it.
 *
 * Only failures that mean "no usable answer because the network or provider
 * was briefly unavailable" are retried. Failures that will not change on a
 * retry (credit balance, auth, validation, constraint violations, bad model
 * output) fail immediately. Timeouts are retried only when the caller says the
 * operation is safe to repeat: a timed-out AI request may still have run and
 * been billed, and the Anthropic SDK already retries it twice on its own.
 */

export interface RetryPolicy {
  /** Total attempts including the first (1 = no retry). */
  attempts: number;
  /** First backoff in ms; doubles on each retry. Default 1 s. */
  baseDelayMs?: number;
  /** Upper bound for a single wait. Default 60 s. */
  maxDelayMs?: number;
}

/** For offline scripts: 6 attempts, 5 s doubling to 120 s, about 6 minutes of patience per call. */
export const OFFLINE_RETRY: RetryPolicy = { attempts: 6, baseDelayMs: 5_000, maxDelayMs: 120_000 };

export interface RetryOptions {
  policy: RetryPolicy;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Never retried, even when the text also looks network-ish. */
const PERMANENT = [
  /credit balance/i,
  /invalid[_ ]?api[_ ]?key|authentication_error|unauthori[sz]ed|forbidden|permission denied|missing_permissions/i,
  /failed to parse structured output|unterminated string|did not match the expected schema|max_tokens|cut off/i,
  /invalid_request_error/i,
];
/** The request never got a response: always safe to repeat. */
const CONNECT = [/fetch failed/i, /connection error/i, /\bE(CONNREFUSED|NOTFOUND|AI_AGAIN|HOSTUNREACH|NETUNREACH)\b/, /UND_ERR_CONNECT_TIMEOUT/];
/** The request may have run: only for callers that can repeat it safely. */
const TIMEOUT = [/timed out/i, /timeout/i, /\bETIMEDOUT\b/, /\babort(ed|error)\b/i];
/** Dropped mid-stream or the provider was overloaded. */
const MIDSTREAM = [/\bECONNRESET\b/, /\bEPIPE\b/, /socket hang up/i, /other side closed/i, /UND_ERR_(SOCKET|CLOSED)/, /overloaded/i, /network (error|request failed)/i];
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504, 529]);

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") return (err as { message: string }).message;
  return String(err);
}

function classificationText(err: unknown): string {
  const e = err as { name?: unknown; code?: unknown; cause?: unknown };
  const cause = e.cause as { code?: unknown } | undefined;
  return [errorMessage(err), e.name, e.code, cause ? errorMessage(cause) : "", cause?.code].filter((x) => x !== undefined && x !== null && x !== "").map(String).join(" ");
}

export function isTransientError(err: unknown, opts: { allowTimeouts?: boolean } = {}): boolean {
  if (err === null || err === undefined) return false;
  const text = classificationText(err);
  if (PERMANENT.some((re) => re.test(text))) return false;
  if (CONNECT.some((re) => re.test(text))) return true;
  if (TIMEOUT.some((re) => re.test(text))) return opts.allowTimeouts === true;
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number") return TRANSIENT_STATUS.has(status);
  return MIDSTREAM.some((re) => re.test(text));
}

/** Exponential backoff with ±20 % jitter, never above the cap. */
export function computeDelay(policy: RetryPolicy, attempt: number, random: () => number = Math.random): number {
  const base = policy.baseDelayMs ?? 1_000;
  const max = policy.maxDelayMs ?? 60_000;
  const exp = Math.min(max, base * 2 ** (attempt - 1));
  return Math.round(Math.min(max, exp * (0.8 + random() * 0.4)));
}

/** Retry a call that throws on failure. */
export async function withRetry<T>(fn: (attempt: number) => PromiseLike<T> | T, opts: RetryOptions): Promise<T> {
  const isRetryable = opts.isRetryable ?? ((e: unknown) => isTransientError(e));
  const sleep = opts.sleep ?? sleepMs;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= opts.policy.attempts || !isRetryable(err)) throw err;
      const delayMs = computeDelay(opts.policy, attempt, opts.random);
      opts.onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }
}

/** Retry a call that reports failure as `{ error }` (Supabase/PostgREST) instead of throwing. */
export async function retryResult<R extends { error: unknown }>(fn: () => PromiseLike<R>, opts: RetryOptions): Promise<R> {
  const isRetryable = opts.isRetryable ?? ((e: unknown) => isTransientError(e));
  const sleep = opts.sleep ?? sleepMs;
  for (let attempt = 1; ; attempt++) {
    const result = await fn();
    if (!result.error || attempt >= opts.policy.attempts || !isRetryable(result.error)) return result;
    const delayMs = computeDelay(opts.policy, attempt, opts.random);
    opts.onRetry?.({ attempt, delayMs, error: result.error });
    await sleep(delayMs);
  }
}
