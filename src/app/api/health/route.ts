import { NextResponse } from "next/server";

/** Lightweight health check for uptime monitoring / Vercel. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "detective-pulse-ops-center",
    time: new Date().toISOString(),
    integrations: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      googleMaps: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      ai: !!process.env.ANTHROPIC_API_KEY,
    },
  });
}
