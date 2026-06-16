"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Actor { id: string; name: string }

interface Props {
  actions: string[];
  entities: string[];
  actors: Actor[];
  count: number;
}

export function AuditFilters({ actions, entities, actors, count }: Props) {
  const t = useTranslations("audit");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function push(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    router.push(pathname);
  }

  const hasFilters =
    sp.has("action") || sp.has("entity") || sp.has("actor") ||
    sp.has("from") || sp.has("to");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Action */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("table.action")}</Label>
          <Select
            value={sp.get("action") ?? "all"}
            onValueChange={(v) => push("action", v)}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allActions")}</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Entity */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("table.entity")}</Label>
          <Select
            value={sp.get("entity") ?? "all"}
            onValueChange={(v) => push("entity", v)}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allEntities")}</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actor */}
        {actors.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("table.actor")}</Label>
            <Select
              value={sp.get("actor") ?? "all"}
              onValueChange={(v) => push("actor", v)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allActors")}</SelectItem>
                {actors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date from */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("filters.dateFrom")}</Label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={sp.get("from") ?? ""}
            onChange={(e) => push("from", e.target.value)}
          />
        </div>

        {/* Date to */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("filters.dateTo")}</Label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={sp.get("to") ?? ""}
            onChange={(e) => push("to", e.target.value)}
          />
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" />
            {t("filters.clearFilters")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {count.toLocaleString()} {count === 1 ? "result" : "results"}
      </p>
    </div>
  );
}
