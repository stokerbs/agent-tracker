/**
 * Keep agents signed in across app restarts: force the Supabase auth cookies to
 * be persistent (a long Max-Age) instead of session cookies that the WebView
 * may drop when the app is closed. Only the `sb-` auth cookies are touched.
 *
 * Persistent sessions are why the app should also lock behind a PIN/biometric —
 * a longer-lived session means a lost/unlocked device must be gated locally.
 */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export function persistAuthCookie(
  name: string,
  options?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!name.startsWith("sb-")) return options;
  return { ...options, maxAge: SESSION_COOKIE_MAX_AGE };
}
