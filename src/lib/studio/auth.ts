import "server-only";

import { getCurrentProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

/**
 * Studio mutation guard. Server actions are callable endpoints, so every
 * action re-checks the role here (pages use requireRole which redirects).
 * V1: admin only.
 */
export async function requireStudioAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Unauthorized");
  return profile;
}

/** Non-throwing variant for actions that return typed results. */
export async function getStudioAdmin(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return profile && profile.role === "admin" ? profile : null;
}
