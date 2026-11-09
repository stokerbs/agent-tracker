import { NextResponse, type NextRequest } from "next/server";
import { isMarketingHost } from "@/lib/marketing/host";
import { marketingLanguageForPath } from "@/lib/marketing/document-language";

// Next.js discovers middleware beside src/app, not at the repository root.
// Only forward presentation metadata for the public .com website. Session
// enforcement remains in the existing layouts, actions, routes and RLS.
export function middleware(request: NextRequest) {
  if (!isMarketingHost(request.headers.get("host"))) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  // Never trust an incoming language header; derive it from the actual URL.
  requestHeaders.set("x-marketing-lang", marketingLanguageForPath(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    {
      source: "/((?!api(?:/|$)|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      has: [{ type: "host", value: "(www\\.)?detectivepulse\\.com" }],
    },
  ],
};
