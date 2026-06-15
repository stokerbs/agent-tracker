import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  battery: z.number().min(0).max(100).optional(),
  status: z
    .enum(["available", "on_mission", "traveling", "break", "offline"])
    .optional(),
});

/**
 * POST /api/agents/location
 * Field devices report their GPS position + battery here every ~60s.
 * Auth is via the user's Supabase session; RLS "agents self update" enforces
 * that an agent can only update their own row.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json(
      { error: "No agent profile linked to this user" },
      { status: 404 },
    );
  }

  const update: Record<string, unknown> = {
    current_lat: parsed.lat,
    current_lng: parsed.lng,
    last_active: new Date().toISOString(),
  };
  if (parsed.battery !== undefined) update.battery_pct = parsed.battery;
  if (parsed.status) update.status = parsed.status;

  const { error } = await supabase
    .from("agents")
    .update(update)
    .eq("id", agent.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
