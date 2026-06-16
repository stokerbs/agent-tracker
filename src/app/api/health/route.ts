import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lightweight health check for uptime monitoring.
 * Requires authentication to avoid leaking integration configuration.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: "ok" });
  }

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
