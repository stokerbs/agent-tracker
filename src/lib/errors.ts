/**
 * Centralised server-side error handling.
 *
 * handleDbError() is the single point where Supabase / PostgREST / Storage
 * errors are processed. It:
 *   1. Logs the full technical detail to the server console (captured by
 *      Vercel / any log aggregator that reads stdout/stderr).
 *   2. Returns a safe, user-facing string that never contains table names,
 *      constraint names, column values, or any other schema internals.
 *
 * Callers use it as:
 *   return { error: handleDbError(error, "createCase") }
 *   // or in API routes:
 *   return NextResponse.json({ error: handleDbError(error, "gps:update") }, { status: 500 })
 */

/**
 * PostgreSQL error codes mapped to user-friendly messages.
 * Full reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 * PostgREST codes: https://docs.postgrest.org/en/stable/references/errors.html
 */
const PG_MESSAGES: Record<string, string> = {
  // Integrity constraint violations
  "23505": "A record with those details already exists.",
  "23503": "The operation references a record that no longer exists.",
  "23502": "A required field is missing.",
  "23514": "The provided value is outside the allowed range.",
  // Privilege / auth
  "42501": "You don't have permission to perform this action.",
  // PostgREST — empty result for .single()
  "PGRST116": "The requested record was not found.",
  // PostgREST — expired or missing JWT
  "PGRST301": "Your session has expired. Please sign in again.",
};

const FALLBACK = "Something went wrong. Please try again.";

/** Minimal shape shared by PostgrestError and StorageError. */
interface AppError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Log the full error server-side and return a safe user-facing message.
 *
 * @param error   - Any Supabase PostgREST or Storage error object.
 * @param context - Short label identifying the operation (e.g. "createCase").
 *                  Appears in the server log to aid debugging.
 */
export function handleDbError(error: AppError, context: string): string {
  console.error("[server error]", {
    context,
    code: error.code ?? null,
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });

  return (error.code !== undefined && PG_MESSAGES[error.code]) || FALLBACK;
}

/**
 * Log an error caught by a Next.js `error.tsx` route boundary.
 *
 * Designed to be imported and called from a client `error.tsx` Client
 * Component. It reuses the same "[server error]" structured console.error
 * convention as handleDbError so boundary failures land in the same log stream.
 *
 * Only the context label, error message, and optional Next.js error digest are
 * logged. The full error object is never spread, so no incidental fields,
 * tokens, environment values, or other sensitive data can leak into the logs.
 *
 * @param error   - The error provided to an error.tsx boundary. Next.js attaches
 *                  an optional `digest` to correlate client/server occurrences.
 * @param context - Short label identifying the boundary (e.g. "dashboard:error").
 */
export function logBoundaryError(
  error: Error & { digest?: string },
  context: string,
): void {
  console.error("[server error]", {
    context,
    message: error.message,
    digest: error.digest ?? null,
  });
}
