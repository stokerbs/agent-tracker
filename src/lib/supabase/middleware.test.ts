/**
 * Regression coverage for the session-redirect gate in updateSession() —
 * specifically that /api/air-tags/webhook/ping is reachable with NO session
 * cookie. That endpoint is a bearer-token-authed webhook (see the route's own
 * doc comment / route.test.ts for its auth tests); it deliberately has no
 * Supabase session for an unattended iOS Shortcuts automation to present, so
 * this middleware must never redirect it to /login the way it does for every
 * other unauthenticated request to a non-public path.
 *
 * route.test.ts (src/app/api/air-tags/webhook/ping/route.test.ts) calls
 * POST() directly and so bypasses middleware entirely — it cannot catch a
 * bug in updateSession() itself. This file exercises updateSession()
 * directly, which is the layer where the bug actually lived (every
 * legitimate webhook call was 307-redirected to /login before the route
 * handler's own token validation ever ran).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}));

import { updateSession } from "./middleware";

function reqFor(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost"));
}

describe("updateSession — /api/air-tags/webhook/ping session-redirect exemption", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("does NOT redirect an unauthenticated (no-session) request to the webhook ping route", async () => {
    const res = await updateSession(reqFor("/api/air-tags/webhook/ping"));

    // A same-origin pass-through (NextResponse.next()) has no Location header
    // and is not a redirect status — a 307/302 to /login is exactly the bug
    // this test guards against.
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(302);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still redirects an unauthenticated request to an unrelated protected API path (no over-broad exemption)", async () => {
    const res = await updateSession(reqFor("/api/some-other-protected-route"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("still redirects an unauthenticated request to a path that merely starts with the webhook route's prefix (exact-path match only, not a startsWith exemption)", async () => {
    const res = await updateSession(reqFor("/api/air-tags/webhook/ping-extra-suffix"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("still redirects an authenticated-required page route when there's no session (sanity check the gate itself still works)", async () => {
    const res = await updateSession(reqFor("/cases/123"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
