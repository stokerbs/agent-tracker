import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/** Whether the user has an app-lock PIN set (read via service role — the hash
 *  table is RLS-locked). Used by the dashboard layout to decide whether to lock. */
export async function userHasPin(profileId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("user_pins")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return !!data;
}
