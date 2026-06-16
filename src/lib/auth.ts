import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

/** Returns the authenticated user's profile, or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Requires an authenticated profile; redirects to /login otherwise. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Requires one of the allowed roles; redirects to /dashboard otherwise. */
export async function requireRole(allowed: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!allowed.includes(profile.role)) redirect("/dashboard");
  return profile;
}

export function isStaff(role: UserRole): boolean {
  return role === "admin" || role === "supervisor";
}

export function isClient(role: UserRole): boolean {
  return role === "client";
}

/** Pure predicate used by requireRole — testable without Next.js runtime. */
export function hasRequiredRole(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}
