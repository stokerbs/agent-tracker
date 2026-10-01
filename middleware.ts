import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Note: the "index only the marketing host" noindex directive is set in
// next.config.ts headers() (host-conditional) — that applies reliably on Vercel,
// whereas a header set here in middleware did not propagate.
export async function middleware(request: NextRequest) {
  // Marketing-site language from the URL prefix, forwarded to the root layout
  // as a request header so <html lang> is correct for /zh (zh-CN) and /en
  // pages — the app's `locale` cookie only knows th/en. Set before
  // updateSession() so the header rides on the forwarded request.
  const path = request.nextUrl.pathname;
  const lang = path === "/zh" || path.startsWith("/zh/") ? "zh-CN" : path === "/en" || path.startsWith("/en/") ? "en" : null;
  if (lang) request.headers.set("x-marketing-lang", lang);
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets & images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
