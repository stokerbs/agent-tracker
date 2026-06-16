"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const FILTER_ROLES = ["all", "client", "agent", "supervisor", "admin"] as const;
type FilterRole = (typeof FILTER_ROLES)[number];

export function UserRoleFilter({ count }: { count: number }) {
  const t = useTranslations("users");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = (params.get("role") ?? "all") as FilterRole;

  function setRole(role: FilterRole) {
    const next = new URLSearchParams(params.toString());
    if (role === "all") next.delete("role");
    else next.set("role", role);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTER_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active === r
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {r === "all" ? t("filter.all") : t(`roles.${r as UserRole}`)}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {t("filter.count", { count })}
      </span>
    </div>
  );
}
