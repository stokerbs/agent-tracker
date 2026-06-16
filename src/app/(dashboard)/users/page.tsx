import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { RoleSelect } from "@/components/users/role-select";
import { UserRoleFilter } from "@/components/users/user-role-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initials, formatDate } from "@/lib/utils";
import type { Profile, UserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const VALID_ROLES: UserRole[] = ["admin", "supervisor", "agent", "client"];

interface Props {
  searchParams: Promise<{ role?: string }>;
}

export default async function UsersPage({ searchParams }: Props) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const t = await getTranslations("users");
  const supabase = await createClient();

  const roleFilter = sp.role && VALID_ROLES.includes(sp.role as UserRole)
    ? (sp.role as UserRole)
    : null;

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (roleFilter) {
    query = query.eq("role", roleFilter);
  }

  const { data } = await query;
  const users = (data as Profile[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Suspense>
        <UserRoleFilter count={users.length} />
      </Suspense>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.user")}</TableHead>
                <TableHead>{t("table.role")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.joined")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                        <AvatarFallback>{initials(u.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleSelect userId={u.id} role={u.role} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "destructive"}>
                      {u.is_active ? t("statusActive") : t("statusDisabled")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(u.created_at)}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    {t("filter.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        {t("roleNote")}
      </p>
    </div>
  );
}
