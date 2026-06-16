import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { UserRoleFilter } from "@/components/users/user-role-filter";
import { UserSearchBar } from "@/components/users/user-search-bar";
import { UsersTable } from "@/components/users/users-table";
import type { AgentStatus, EnrichedUser, Profile, UserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const VALID_ROLES: UserRole[] = ["admin", "supervisor", "agent", "client"];

interface Props {
  searchParams: Promise<{ role?: string; q?: string }>;
}

export default async function UsersPage({ searchParams }: Props) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const t = await getTranslations("users");
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const roleFilter =
    sp.role && VALID_ROLES.includes(sp.role as UserRole)
      ? (sp.role as UserRole)
      : null;
  const search = sp.q?.trim().toLowerCase() ?? "";

  // ─── 1. Profiles ────────────────────────────────────────────────────────────
  let profileQuery = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (roleFilter) profileQuery = profileQuery.eq("role", roleFilter);

  const { data: profilesRaw } = await profileQuery;
  const profiles = (profilesRaw ?? []) as Profile[];

  // ─── 2. Auth users (last_sign_in_at, otp_verified) ──────────────────────────
  const { data: authData } = await serviceClient.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  const authMap = new Map(
    (authData?.users ?? []).map((u) => [
      u.id,
      {
        last_sign_in_at: u.last_sign_in_at ?? null,
        otp_verified: !!(
          u.phone_confirmed_at ??
          u.email_confirmed_at ??
          (u as any).confirmed_at
        ),
      },
    ]),
  );

  // ─── 3. Agents (agent_code, status, battery for linked profiles) ────────────
  const { data: agentsRaw } = await supabase
    .from("agents")
    .select("profile_id, agent_code, status, battery_pct")
    .not("profile_id", "is", null);
  const agentMap = new Map(
    (agentsRaw ?? []).map((a) => [
      a.profile_id as string,
      {
        agent_code: a.agent_code as string,
        agent_status: a.status as AgentStatus,
        battery_pct: a.battery_pct as number | null,
      },
    ]),
  );

  // ─── 4. Merge ────────────────────────────────────────────────────────────────
  let enriched: EnrichedUser[] = profiles.map((p) => {
    const auth = authMap.get(p.id);
    const agent = agentMap.get(p.id);
    return {
      ...p,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      otp_verified: auth?.otp_verified ?? false,
      agent_code: agent?.agent_code ?? null,
      agent_status: agent?.agent_status ?? null,
      battery_pct: agent?.battery_pct ?? null,
    };
  });

  // ─── 5. Client-side-style search (all fields including agent_code) ───────────
  if (search) {
    enriched = enriched.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(search) ||
        u.phone?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search) ||
        u.agent_code?.toLowerCase().includes(search),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Suspense>
          <UserRoleFilter count={enriched.length} />
        </Suspense>
        <Suspense>
          <UserSearchBar />
        </Suspense>
      </div>

      <UsersTable users={enriched} />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        {t("roleNote")}
      </p>
    </div>
  );
}
