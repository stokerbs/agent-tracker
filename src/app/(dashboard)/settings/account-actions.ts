"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Permanently delete the current user's own account (App Store / Play Store
 * requirement for apps that allow account creation).
 *
 * Deletes the auth user via the admin API, which cascades to the profiles row
 * and everything FK'd to it (device_tokens, gps_tokens, notifications, etc.).
 * Linked agent/client records are unlinked (profile_id → NULL), not deleted, so
 * case history is preserved. Signs the session out and redirects to login.
 *
 * Guard: refuses to delete the last active administrator so an org can't lock
 * itself out (reviewers test with a normal account, so this never blocks review).
 */
export async function deleteOwnAccount(): Promise<{ error: string } | void> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };

  const svc = createServiceClient();

  if (profile.role === "admin") {
    const { count } = await svc
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return {
        error:
          "You are the last administrator. Assign another admin before deleting your account.",
      };
    }
  }

  // Explicit cleanup of native tokens (also covered by FK cascade).
  await svc.from("device_tokens").delete().eq("profile_id", profile.id);
  await svc.from("gps_tokens").delete().eq("profile_id", profile.id);

  const { error } = await svc.auth.admin.deleteUser(profile.id);
  if (error) {
    console.error("[deleteOwnAccount]", error);
    return { error: "Could not delete your account. Please try again." };
  }

  // Clear the now-orphaned session cookie, then leave the app.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
