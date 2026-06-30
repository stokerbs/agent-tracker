import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Note: the "index only the marketing host" noindex directive is set in
// next.config.ts headers() (host-conditional) — that applies reliably on Vercel,
// whereas a header set here in middleware did not propagate.
export async function middleware(request: NextRequest) {
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
