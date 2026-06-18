"use client";

import { useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = ["photo", "video", "pdf", "audio", "document"] as const;

export function EvidenceFilters({ count }: { count: number }) {
  const t = useTranslations("evidence");
  const tf = useTranslations("evidence.filters");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function pushDebounced(key: string, value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push(key, value), 300);
  }

  const hasFilters = sp.has("q") || sp.has("type");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="h-8 w-48 pl-8 text-xs"
          placeholder={tf("searchPlaceholder")}
          defaultValue={sp.get("q") ?? ""}
          onChange={(e) => pushDebounced("q", e.target.value)}
        />
      </div>

      <Select
        value={sp.get("type") ?? "all"}
        onValueChange={(v) => push("type", v)}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tf("allTypes")}</SelectItem>
          {TYPES.map((tp) => (
            <SelectItem key={tp} value={tp}>
              {t(`typeLabels.${tp}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={() => router.push(pathname)}
        >
          <X className="h-3 w-3" />
          {tf("clearFilters")}
        </Button>
      )}

      <span className="ml-auto text-xs text-muted-foreground">
        {tf("results", { count })}
      </span>
    </div>
  );
}
