"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { UserDetailDialog } from "@/components/users/user-detail-dialog";
import { RoleSelect } from "@/components/users/role-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { cn, initials, timeAgo } from "@/lib/utils";
import type { EnrichedUser } from "@/lib/types";

type SortCol = "full_name" | "phone" | "agent_code" | "created_at" | "last_sign_in_at";
type SortDir = "asc" | "desc";

function sortUsers(users: EnrichedUser[], col: SortCol, dir: SortDir): EnrichedUser[] {
  return [...users].sort((a, b) => {
    let va: string | null = null;
    let vb: string | null = null;
    switch (col) {
      case "full_name":    va = a.full_name?.toLowerCase() ?? ""; vb = b.full_name?.toLowerCase() ?? ""; break;
      case "phone":        va = a.phone ?? ""; vb = b.phone ?? ""; break;
      case "agent_code":   va = a.agent_code ?? ""; vb = b.agent_code ?? ""; break;
      case "created_at":   va = a.created_at; vb = b.created_at; break;
      case "last_sign_in_at": va = a.last_sign_in_at ?? ""; vb = b.last_sign_in_at ?? ""; break;
    }
    const cmp = (va ?? "").localeCompare(vb ?? "");
    return dir === "asc" ? cmp : -cmp;
  });
}

export function UsersTable({ users }: { users: EnrichedUser[] }) {
  const t = useTranslations("users");
  const [sortCol, setSortCol] = useState<SortCol>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<EnrichedUser | null>(null);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const sorted = useMemo(() => sortUsers(users, sortCol, sortDir), [users, sortCol, sortDir]);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label={t("table.user")} col="full_name" current={sortCol} dir={sortDir} onSort={toggleSort} />
                  <TableHead className="w-44">{t("table.role")}</TableHead>
                  <SortHead label={t("table.phone")} col="phone" current={sortCol} dir={sortDir} onSort={toggleSort} />
                  <SortHead label={t("table.agentCode")} col="agent_code" current={sortCol} dir={sortDir} onSort={toggleSort} />
                  <SortHead label={t("table.createdAt")} col="created_at" current={sortCol} dir={sortDir} onSort={toggleSort} />
                  <SortHead label={t("table.lastLogin")} col="last_sign_in_at" current={sortCol} dir={sortDir} onSort={toggleSort} />
                  <TableHead>{t("table.otpVerified")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={(e) => {
                      // Don't open drawer when interacting with the role select
                      if ((e.target as HTMLElement).closest("[data-radix-select-trigger]")) return;
                      setSelected(u);
                    }}
                  >
                    {/* Identity */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          {u.avatar_url && <AvatarFallback>{initials(u.full_name)}</AvatarFallback>}
                          <AvatarFallback className="text-xs font-semibold">
                            {initials(u.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {u.full_name ?? u.phone ?? "—"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email ?? u.phone ?? "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role select */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RoleSelect userId={u.id} role={u.role} />
                    </TableCell>

                    {/* Phone */}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {u.phone ?? "—"}
                    </TableCell>

                    {/* Agent code */}
                    <TableCell>
                      {u.agent_code ? (
                        <span className="font-mono text-xs font-bold tracking-wider text-primary">
                          {u.agent_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Created at */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(u.created_at)}
                    </TableCell>

                    {/* Last login */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : "—"}
                    </TableCell>

                    {/* OTP verified */}
                    <TableCell>
                      {u.otp_verified ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant={u.is_active ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {u.is_active ? t("statusActive") : t("statusDisabled")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {t("filter.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserDetailDialog user={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function SortHead({
  label, col, current, dir, onSort,
}: {
  label: string;
  col: SortCol;
  current: SortCol;
  dir: SortDir;
  onSort: (col: SortCol) => void;
}) {
  const active = current === col;
  return (
    <TableHead>
      <button
        onClick={() => onSort(col)}
        className={cn(
          "flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wider",
          "hover:text-foreground transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
