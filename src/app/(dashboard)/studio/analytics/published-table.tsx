"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PillarBadge, PlatformChip } from "@/components/studio/badges";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MetricsDialog } from "./metrics-dialog";

export interface SnapshotView {
  id: string;
  platform: string;
  recorded_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  completion_rate: number | null;
  leads: number | null;
  qualified_leads: number | null;
  conversions: number | null;
  note: string | null;
}

export interface PublishedRow {
  id: string;
  title: string;
  pillar: string;
  primary_platform: string | null;
  published_at: string | null;
  published_url: string | null;
  latest: SnapshotView | null;
  history: SnapshotView[];
}

function n(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("en-GB");
}

export function PublishedTable({ rows }: { rows: PublishedRow[] }) {
  const [target, setTarget] = useState<PublishedRow | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>คอนเทนต์</TableHead>
              <TableHead>Pillar</TableHead>
              <TableHead>แพลตฟอร์ม</TableHead>
              <TableHead className="whitespace-nowrap">เผยแพร่</TableHead>
              <TableHead className="text-right">วิว</TableHead>
              <TableHead className="text-right">ไลก์</TableHead>
              <TableHead className="text-right">แชร์</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="whitespace-nowrap">สแนปช็อตล่าสุด</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const open = expanded.has(r.id);
              return (
                <Fragment key={r.id}>
                  <TableRow className={cn(open && "bg-muted/30")}>
                    <TableCell className="p-2">
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        disabled={r.history.length === 0}
                        aria-expanded={open}
                        aria-label="ดูประวัติสถิติ"
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                      </button>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/studio/content/${r.id}`} className="truncate text-sm font-medium hover:text-primary hover:underline">
                          {r.title}
                        </Link>
                        {r.published_url && (
                          <a href={r.published_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-primary" aria-label="เปิดโพสต์">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {r.history.length > 0 && <p className="text-[11px] text-muted-foreground">{r.history.length} สแนปช็อต</p>}
                    </TableCell>
                    <TableCell>
                      <PillarBadge pillar={r.pillar} />
                    </TableCell>
                    <TableCell>{r.primary_platform ? <PlatformChip platform={r.primary_platform} short /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.published_at)}</TableCell>
                    {r.latest ? (
                      <>
                        <TableCell className="text-right font-mono text-xs tabular-nums">{n(r.latest.views)}</TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">{n(r.latest.likes)}</TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">{n(r.latest.shares)}</TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {n(r.latest.leads)}
                          {r.latest.qualified_leads !== null && <span className="text-muted-foreground"> / {r.latest.qualified_leads}</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(r.latest.recorded_at)} · <PlatformChip platform={r.latest.platform} short className="align-middle" />
                        </TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={5} className="text-xs text-muted-foreground">
                        ยังไม่มีข้อมูล
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setTarget(r)}>
                        <PenLine className="h-3.5 w-3.5" /> บันทึกผล
                      </Button>
                    </TableCell>
                  </TableRow>

                  {open && r.history.length > 0 && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={11} className="p-0">
                        <div className="px-4 py-3 sm:px-12">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">ประวัติสถิติ (ใหม่ → เก่า)</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted-foreground">
                                  <th className="py-1 pr-3 font-medium">เวลา</th>
                                  <th className="py-1 pr-3 font-medium">แพลตฟอร์ม</th>
                                  <th className="py-1 pr-3 text-right font-medium">วิว</th>
                                  <th className="py-1 pr-3 text-right font-medium">ไลก์</th>
                                  <th className="py-1 pr-3 text-right font-medium">คอมเมนต์</th>
                                  <th className="py-1 pr-3 text-right font-medium">แชร์</th>
                                  <th className="py-1 pr-3 text-right font-medium">บันทึก</th>
                                  <th className="py-1 pr-3 text-right font-medium">ดูจบ %</th>
                                  <th className="py-1 pr-3 text-right font-medium">Leads / Q</th>
                                  <th className="py-1 pr-3 text-right font-medium">ปิดงาน</th>
                                  <th className="py-1 font-medium">หมายเหตุ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.history.map((s) => (
                                  <tr key={s.id} className="border-t border-border/60">
                                    <td className="whitespace-nowrap py-1.5 pr-3">
                                      {formatDate(s.recorded_at)} {new Date(s.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
                                    </td>
                                    <td className="py-1.5 pr-3">
                                      <PlatformChip platform={s.platform} short />
                                    </td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{n(s.views)}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{n(s.likes)}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{n(s.comments)}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{n(s.shares)}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{n(s.saves)}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{s.completion_rate === null ? "—" : `${s.completion_rate}%`}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                                      {n(s.leads)} / {n(s.qualified_leads)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{n(s.conversions)}</td>
                                    <td className="max-w-[240px] truncate py-1.5 text-muted-foreground" title={s.note ?? undefined}>
                                      {s.note ?? ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <MetricsDialog key={target?.id ?? "none"} open={target !== null} onOpenChange={(v) => !v && setTarget(null)} master={target ? { id: target.id, title: target.title, primary_platform: target.primary_platform } : null} />
    </>
  );
}
