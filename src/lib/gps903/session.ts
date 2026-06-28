import { SESSION_TTL_MS, type SvcClient, hasAuthTicket } from "./client";
import { gps903Login } from "./login";

// Each GPS903 device has its own IMEI login → distinct ASP.NET session.
// Sessions are cached in gps903_credential_sessions keyed by credential UUID.

export interface Gps903CredentialForSession {
  id:              string;
  imei:            string;
  device_password: string;
}

/**
 * Return a valid ASP.NET session cookie for one credential.
 * Checks gps903_credential_sessions for a non-expired, auth-ticket-bearing cookie.
 * On cache miss or expiry, performs a fresh IMEI login and caches the result.
 */
export async function getOrRefreshCredentialSession(
  svc: SvcClient,
  credential: Gps903CredentialForSession,
): Promise<string | null> {
  const { data: cached } = await svc
    .from("gps903_credential_sessions")
    .select("session_cookie, expires_at")
    .eq("credential_id", credential.id)
    .maybeSingle();

  if (
    cached &&
    new Date(cached.expires_at) > new Date() &&
    hasAuthTicket(cached.session_cookie)
  ) {
    console.log(`[GPS903] Using cached session for credential ${credential.id.slice(0, 8)}`);
    return cached.session_cookie;
  }

  console.log(`[GPS903] Session cache miss for credential ${credential.id.slice(0, 8)} — logging in`);
  const fresh = await gps903Login(credential.imei, credential.device_password);
  if (!fresh) return null;

  await svc.from("gps903_credential_sessions").upsert({
    credential_id:  credential.id,
    session_cookie: fresh,
    expires_at:     new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    updated_at:     new Date().toISOString(),
  });

  console.log(`[GPS903] Session cached for credential ${credential.id.slice(0, 8)}`);
  return fresh;
}
