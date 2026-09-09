"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Clock, FileText, LayoutGrid, Lightbulb, Loader2, Plus, Search, Sparkles, Table2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ContentStatusBadge, PillarBadge, PlatformChip, PrivacyBadge } from "@/components/studio/badges";
import { CONTENT_STATUS_META, PILLAR_META, PILLARS, PIPELINE_STATUSES, PLATFORM_META, PLATFORMS } from "@/lib/studio/constants";
import { formatDuration } from "@/lib/studio/duration";
import { TARGET_DURATIONS, type ContentStatus, type Pillar, type Platform } from "@/lib/studio/types";
import { cn, formatDate } from "@/lib/utils";
import { createContentMaster } from "./actions";
import { formatTimeBkk } from "./format";
import type { ContentListFilters, ContentListRow } from "./queries";

// ─── URL helpers ─────────────────────────────────────────────────────────────
function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );
}

// ─── Create dialog ───────────────────────────────────────────────────────────
export function CreateContentButton({ variant = "default", size = "sm", label = "สร้างคอนเทนต์ใหม่" }: { variant?: "default" | "outline"; size?: "sm" | "default"; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {label}
      </Button>
      <CreateContentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CreateContentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState<Pillar>("detective_knowledge");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [duration, setDuration] = useState<string>("45");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("กรุณาระบุชื่อคอนเทนต์");
      return;
    }
    start(async () => {
      const res = await createContentMaster({
        title: title.trim(),
        pillar,
        primaryPlatform: platform,
        targetDurationSec: duration === "none" ? null : Number(duration),
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("สร้างร่างคอนเทนต์แล้ว");
      onOpenChange(false);
      router.push(`/studio/content/${res.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างคอนเทนต์ใหม่</DialogTitle>
          <DialogDescription>เริ่มจากร่างว่าง แล้วเขียนเองหรือให้ AI ช่วยร่างสคริปต์ในหน้าแก้ไข</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="new-title">ชื่อคอนเทนต์</Label>
            <Input
              id="new-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น 3 สิ่งที่นักสืบมองหาใน 10 นาทีแรกของการเฝ้าติดตาม"
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>เสาคอนเทนต์</Label>
              <Select value={pillar} onValueChange={(v) => setPillar(v as Pillar)}>
                <SelectTrigger aria-label="เสาคอนเทนต์">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILLARS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PILLAR_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>แพลตฟอร์มหลัก</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger aria-label="แพลตฟอร์มหลัก">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLATFORM_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ความยาวเป้าหมาย</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger aria-label="ความยาวเป้าหมาย">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} วินาที
                  </SelectItem>
                ))}
                <SelectItem value="none">ไม่กำหนด (โพสต์/บทความ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} สร้างร่าง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────
function Toolbar({ view, filters }: { view: "board" | "table"; filters: ContentListFilters }) {
  const update = useQueryUpdater();
  const [q, setQ] = useState(filters.q ?? "");
  const hasFilters = !!(filters.pillar || filters.platform || filters.status || filters.q);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="มุมมอง" className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
          {(
            [
              { key: "board", label: "บอร์ด", icon: LayoutGrid },
              { key: "table", label: "ตาราง", icon: Table2 },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={view === key}
              onClick={() => update({ view: key === "board" ? null : key })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === key ? "bg-background text-foreground shadow" : "hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <form
          className="relative min-w-[200px] flex-1 sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อคอนเทนต์…" className="h-9 pl-8" aria-label="ค้นหา" />
        </form>

        <Select value={filters.platform ?? "all"} onValueChange={(v) => update({ platform: v === "all" ? null : v })}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="แพลตฟอร์ม">
            <SelectValue placeholder="แพลตฟอร์ม" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {PLATFORM_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status ?? "all"} onValueChange={(v) => update({ status: v === "all" ? null : v })}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="สถานะ">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            {(["draft", "review", "approved", "scheduled", "published", "archived", "rejected"] as ContentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {CONTENT_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => {
              setQ("");
              update({ pillar: null, platform: null, status: null, q: null });
            }}
          >
            <X className="h-3.5 w-3.5" /> ล้างตัวกรอง
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="เสาคอนเทนต์">
        <button
          type="button"
          onClick={() => update({ pillar: null })}
          aria-pressed={!filters.pillar}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !filters.pillar ? "border-foreground/30 bg-foreground/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          ทุกเสา
        </button>
        {PILLARS.map((p) => {
          const active = filters.pillar === p;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={active}
              onClick={() => update({ pillar: active ? null : p })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? PILLAR_META[p].badge : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", PILLAR_META[p].dot)} />
              {PILLAR_META[p].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function DurationText({ row }: { row: ContentListRow }) {
  if (!row.estimated_duration_sec) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Clock className="h-3 w-3" /> ~{formatDuration(row.estimated_duration_sec)}
      {row.target_duration_sec ? <span className="text-muted-foreground/60">/ {row.target_duration_sec} วิ</span> : null}
    </span>
  );
}

function ContentCard({ row }: { row: ContentListRow }) {
  return (
    <Link
      href={`/studio/content/${row.id}`}
      className="group block rounded-lg border border-border/70 bg-card p-3 shadow-sm transition-colors hover:border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">{row.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PillarBadge pillar={row.pillar} />
        {row.primary_platform && <PlatformChip platform={row.primary_platform} short />}
        <PrivacyBadge status={row.privacy_status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {row.scheduled_at ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-violet-600 dark:text-violet-400">
            <CalendarClock className="h-3 w-3" /> {formatDate(row.scheduled_at)} {formatTimeBkk(row.scheduled_at)}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/70">แก้ไข {formatDate(row.updated_at)}</span>
        )}
        <DurationText row={row} />
      </div>
    </Link>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────
function BoardView({ rows, counts }: { rows: ContentListRow[]; counts: Record<string, number> }) {
  const update = useQueryUpdater();
  const byStatus = useMemo(() => {
    const m = new Map<string, ContentListRow[]>();
    for (const r of rows) m.set(r.status, [...(m.get(r.status) ?? []), r]);
    return m;
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[960px] grid-cols-5 gap-3">
          {PIPELINE_STATUSES.map((status) => {
            const items = byStatus.get(status) ?? [];
            const meta = CONTENT_STATUS_META[status];
            return (
              <section key={status} aria-label={meta.label} className="flex min-h-[240px] flex-col rounded-xl border border-border/60 bg-muted/20">
                <header className="flex items-center justify-between px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                    <span className={cn("h-2 w-2 rounded-full", meta.dot)} /> {meta.label}
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
                </header>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-6 text-center text-[11px] text-muted-foreground/60">ไม่มีรายการ</p>
                  ) : (
                    items.map((r) => <ContentCard key={r.id} row={r} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>อื่น ๆ:</span>
        {(["archived", "rejected"] as ContentStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => update({ status: s, view: "table" })}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", CONTENT_STATUS_META[s].dot)} />
            {CONTENT_STATUS_META[s].label} <span className="tabular-nums">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────
type SortKey = "title" | "pillar" | "status" | "scheduled_at" | "updated_at" | "estimated_duration_sec";
const STATUS_ORDER: Record<string, number> = { draft: 0, review: 1, approved: 2, scheduled: 3, published: 4, archived: 5, rejected: 6, idea: -1 };

function TableView({ rows }: { rows: ContentListRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "updated_at", dir: "desc" });
  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const k = sort.key;
      if (k === "status") return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
      const av = a[k] ?? "";
      const bv = b[k] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "th") * dir;
    });
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "title" ? "asc" : "desc" }));
  }
  function SortHead({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {children} <Icon className={cn("h-3 w-3", active ? "text-foreground" : "text-muted-foreground/50")} />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead k="title" className="min-w-[280px]">
              ชื่อ
            </SortHead>
            <SortHead k="status">สถานะ</SortHead>
            <SortHead k="pillar">เสา</SortHead>
            <TableHead>แพลตฟอร์ม</TableHead>
            <TableHead>Privacy</TableHead>
            <SortHead k="scheduled_at">กำหนดโพสต์</SortHead>
            <SortHead k="estimated_duration_sec">ความยาว</SortHead>
            <SortHead k="updated_at">แก้ไขล่าสุด</SortHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <Link href={`/studio/content/${r.id}`} className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {r.title}
                </Link>
                {r.variant_count > 0 && <span className="ml-2 text-[11px] text-muted-foreground">+{r.variant_count} เวอร์ชัน</span>}
              </TableCell>
              <TableCell>
                <ContentStatusBadge status={r.status} />
              </TableCell>
              <TableCell>
                <PillarBadge pillar={r.pillar} />
              </TableCell>
              <TableCell>{r.primary_platform ? <PlatformChip platform={r.primary_platform} short /> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell>
                <PrivacyBadge status={r.privacy_status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">{r.scheduled_at ? `${formatDate(r.scheduled_at)} ${formatTimeBkk(r.scheduled_at)}` : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {r.estimated_duration_sec ? `~${formatDuration(r.estimated_duration_sec)}` : <span className="text-muted-foreground">—</span>}
                {r.target_duration_sec ? <span className="text-muted-foreground"> / {r.target_duration_sec} วิ</span> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────
export function ContentBoard({ rows, counts, view, filters }: { rows: ContentListRow[]; counts: Record<string, number>; view: "board" | "table"; filters: ContentListFilters }) {
  const update = useQueryUpdater();
  const hasFilters = !!(filters.pillar || filters.platform || filters.status || filters.q);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <Toolbar view={view} filters={filters} />

      {rows.length === 0 ? (
        total === 0 && !hasFilters ? (
          <div className="rounded-xl border border-dashed border-border/80">
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="ยังไม่มีคอนเทนต์"
              description="เริ่มจากไอเดียใน Idea Bank, ให้ Creative Director วางแคมเปญ หรือสร้างร่างว่างแล้วเขียนเอง"
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/studio/ideas">
                      <Lightbulb className="h-4 w-4" /> ไปที่ Idea Bank
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/studio/director">
                      <Sparkles className="h-4 w-4" /> Creative Director
                    </Link>
                  </Button>
                  <CreateContentButton />
                </div>
              }
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80">
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="ไม่พบคอนเทนต์ที่ตรงกับตัวกรอง"
              description="ลองเปลี่ยนเสาคอนเทนต์ แพลตฟอร์ม สถานะ หรือคำค้น"
              action={
                <Button variant="outline" size="sm" onClick={() => update({ pillar: null, platform: null, status: null, q: null })}>
                  <X className="h-4 w-4" /> ล้างตัวกรอง
                </Button>
              }
            />
          </div>
        )
      ) : view === "board" ? (
        <BoardView rows={rows} counts={counts} />
      ) : (
        <TableView rows={rows} />
      )}
    </div>
  );
}
