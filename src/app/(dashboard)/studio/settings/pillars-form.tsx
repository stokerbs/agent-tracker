"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PILLAR_META, PILLARS } from "@/lib/studio/constants";
import { PillarBadge } from "@/components/studio/badges";
import type { Pillar, PillarConfig } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { updatePillars } from "./actions";

export function PillarsForm({ initial }: { initial: PillarConfig[] }) {
  const [pct, setPct] = useState<Record<Pillar, number>>(() => {
    const map = Object.fromEntries(PILLARS.map((k) => [k, 0])) as Record<Pillar, number>;
    for (const p of initial) if (p.key in map) map[p.key] = p.target_pct;
    return map;
  });
  const [pending, start] = useTransition();
  const sum = useMemo(() => PILLARS.reduce((s, k) => s + (Number.isFinite(pct[k]) ? pct[k] : 0), 0), [pct]);
  const valid = sum === 100;

  function save() {
    start(async () => {
      try {
        const res = await updatePillars({ pillars: PILLARS.map((key) => ({ key, target_pct: pct[key] })) });
        if (res.ok) toast.success("บันทึกสัดส่วน pillar แล้ว");
        else toast.error(res.error);
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Pillar</th>
              <th className="hidden py-2 pr-3 font-medium md:table-cell">คำอธิบาย</th>
              <th className="w-28 py-2 text-right font-medium">เป้าหมาย %</th>
            </tr>
          </thead>
          <tbody>
            {PILLARS.map((key) => (
              <tr key={key} className="border-b last:border-0">
                <td className="py-2.5 pr-3 align-top">
                  <PillarBadge pillar={key} />
                </td>
                <td className="hidden py-2.5 pr-3 align-top text-xs text-muted-foreground md:table-cell">{PILLAR_META[key].description}</td>
                <td className="py-2.5 text-right align-top">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={pct[key]}
                    disabled={pending}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                      setPct({ ...pct, [key]: n });
                    }}
                    className="h-8 w-24 text-right tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">รวม</span>
          <span className={cn("font-mono font-semibold tabular-nums", valid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {sum}% {valid ? "✓" : `(ต้องเท่ากับ 100 — ${sum > 100 ? "เกิน" : "ขาด"} ${Math.abs(100 - sum)})`}
          </span>
        </div>
        <Progress value={Math.min(sum, 100)} className={cn("h-1.5", !valid && "[&>div]:bg-destructive")} />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !valid} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
