import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isMarketingHost } from "@/lib/seo/host";

// The public marketing site lives on detectivepulse.com; the app on .app (and
// vercel preview / localhost) is the private, "unlisted" tool. Search engines
// must index ONLY the marketing host — every other host gets X-Robots-Tag
// noindex regardless of robots.txt (which is shared across both domains).
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  if (!isMarketingHost(request.headers.get("host"))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets & images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
