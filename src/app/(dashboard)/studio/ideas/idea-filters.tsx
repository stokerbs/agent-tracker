"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IDEA_STATUS_META, PILLAR_META, PILLARS, PLATFORM_META, PLATFORMS } from "@/lib/studio/constants";
import type { IdeaStatus, Pillar } from "@/lib/studio/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const STATUS_ACTIVE = "active";
const ALL = "__all__";
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: STATUS_ACTIVE, label: "ที่ใช้งาน (ซ่อนปัดตก/เก็บถาวร)" },
  { value: ALL, label: "ทั้งหมด" },
  ...(Object.keys(IDEA_STATUS_META) as IdeaStatus[]).map((s) => ({ value: s, label: IDEA_STATUS_META[s].label })),
];

export interface IdeaFilterValues {
  pillar: Pillar | null;
  status: string;
  platform: string | null;
  campaign: string | null;
  q: string;
}

/** URL-driven filter bar: pillar chips · status · platform · campaign · search. */
export function IdeaFilters({ values, campaigns, counts }: { values: IdeaFilterValues; campaigns: { id: string; title: string }[]; counts?: Partial<Record<Pillar | "all", number>> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(values.q);
  const [pending, start] = useTransition();

  useEffect(() => setQ(values.q), [values.q]);

  function push(patch: Partial<Record<keyof IdeaFilterValues, string | null>>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL || (k === "status" && v === STATUS_ACTIVE)) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const hasAny = !!(values.pillar || values.platform || values.campaign || values.q || values.status !== STATUS_ACTIVE);
  const campaignTitle = values.campaign ? campaigns.find((c) => c.id === values.campaign)?.title : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={!values.pillar} onClick={() => push({ pillar: null })} count={counts?.all}>
          ทั้งหมด
        </Chip>
        {PILLARS.map((p) => (
          <Chip key={p} active={values.pillar === p} onClick={() => push({ pillar: values.pillar === p ? null : p })} dot={PILLAR_META[p].dot} count={counts?.[p]}>
            {PILLAR_META[p].label}
          </Chip>
        ))}
        {pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: q.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อไอเดียหรือ hook… (Enter)" className="h-9 pl-8 pr-8" />
          {q && (
            <button
              type="button"
              aria-label="ล้างคำค้น"
              onClick={() => {
                setQ("");
                push({ q: null });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
          <Select value={values.status} onValueChange={(v) => push({ status: v })}>
            <SelectTrigger className="h-9 text-xs md:w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={values.platform ?? ALL} onValueChange={(v) => push({ platform: v })}>
            <SelectTrigger className="h-9 text-xs md:w-[150px]">
              <SelectValue placeholder="แพลตฟอร์ม" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">
                ทุกแพลตฟอร์ม
              </SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {PLATFORM_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {campaigns.length > 0 && (
            <Select value={values.campaign ?? ALL} onValueChange={(v) => push({ campaign: v })}>
              <SelectTrigger className="col-span-2 h-9 text-xs md:w-[220px]">
                <SelectValue placeholder="แคมเปญ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-xs">
                  ทุกแคมเปญ
                </SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasAny && (
            <Button variant="ghost" size="sm" className="col-span-2 text-xs text-muted-foreground" onClick={() => push({ pillar: null, status: null, platform: null, campaign: null, q: null })}>
              <X className="mr-1 h-3.5 w-3.5" /> ล้างตัวกรอง
            </Button>
          )}
        </div>
      </div>

      {values.campaign && !campaignTitle && <p className="text-xs text-muted-foreground">กรองตามแคมเปญ (ไม่พบชื่อแคมเปญนี้ในรายการล่าสุด)</p>}
    </div>
  );
}

function Chip({ active, onClick, dot, count, children }: { active: boolean; onClick: () => void; dot?: string; count?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-foreground/30 bg-foreground text-background" : "border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-background/70" : dot)} />}
      {children}
      {typeof count === "number" && <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground/70")}>{count}</span>}
    </button>
  );
}
