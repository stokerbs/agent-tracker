import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { persistAuthCookie } from "./cookie-options";

// /login covers /login/verify (startsWith check), so no extra entry needed.
// /review/<token> is the token-gated AI-article approval page opened from LINE
// (no login) — the random one-time token is the capability, so it's public.
const PUBLIC_PATHS = ["/login", "/register", "/auth", "/portal/login", "/privacy", "/support", "/review"];

// Narrow, explicit allowlist of individual API routes that are intentionally
// unauthenticated-by-session — deliberately NOT folded into PUBLIC_PATHS
// (which matches by startsWith prefix) to avoid ever accidentally exempting
// a broader "/api/..." prefix and stripping session auth from every other,
// currently-protected API route.
//
// /api/air-tags/webhook/ping — called by an unattended iOS Shortcuts
// automation with a per-tracker bearer token and no interactive Supabase
// session, so there is never a session cookie for this route to check. Auth
// is enforced inside the route handler itself (Authorization: Bearer token,
// validated against air_tag_webhook_tokens), not by this session middleware.
const EXEMPT_API_ROUTES = ["/api/air-tags/webhook/ping"];

/**
 * Refreshes the Supabase session on every request and enforces auth on
 * protected routes. Wired up in the root middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // When env is not configured (e.g. first boot), don't hard-fail routing.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, persistAuthCookie(name, value, options) as never),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p)) || EXEMPT_API_ROUTES.includes(path);

  if (!user && !isPublic && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
