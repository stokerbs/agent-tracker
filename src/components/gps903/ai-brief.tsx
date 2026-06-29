"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Sparkles, Loader2, Route, Timer, Gauge, MapPin } from "lucide-react";
import type { GpsDeviceForMap } from "@/lib/types";

interface Stop { lat: number; lng: number; startedAt: string; endedAt: string; minutes: number }
interface Summary {
  fixes: number; distanceKm: number; movingMinutes: number; stoppedMinutes: number;
  maxSpeedKmh: number; stops: Stop[];
}
interface BriefResult { deviceLabel: string; hours: number; summary: Summary; brief: string; ai: boolean }

const RANGES = [
  { label: "24 ชม.", hours: 24 },
  { label: "3 วัน", hours: 72 },
  { label: "7 วัน", hours: 168 },
] as const;

function mins(n: number) {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h > 0 ? `${h}ชม ${m}น` : `${m}น`;
}

// Render plain text with any http(s) URL turned into a clickable link.
function linkify(text: string): React.ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline underline-offset-2 break-all">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <p className="mt-0.5 font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

export function AiBrief({ device, onClose }: { device: GpsDeviceForMap; onClose: () => void }) {
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BriefResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (h: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gps/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.id, hours: h }),
      });
      if (!res.ok) throw new Error(`(${res.status})`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [device.id]);

  useEffect(() => { load(hours); }, [hours, load]);

  const s = data?.summary;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data?.deviceLabel ?? "บทสรุปข่าวกรอง"}</p>
            <p className="font-mono text-[11px] text-muted-foreground">AI Surveillance Brief</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="ปิด" className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Range selector */}
      <div className="flex gap-1.5 border-b border-border/60 px-4 py-2">
        {RANGES.map((r) => (
          <button
            key={r.hours}
            onClick={() => setHours(r.hours)}
            disabled={loading}
            className={`rounded-md px-3 py-1 text-xs font-semibold ${
              hours === r.hours ? "bg-primary text-primary-foreground" : "border border-border/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังวิเคราะห์เส้นทาง…
          </div>
        )}

        {!loading && error && (
          <div className="py-16 text-center text-sm text-red-400">โหลดไม่สำเร็จ {error}</div>
        )}

        {!loading && !error && s && (
          <div className="mx-auto max-w-xl space-y-4">
            {s.fixes === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
                <MapPin className="h-7 w-7 text-muted-foreground/30" />
                ไม่มีข้อมูลการเคลื่อนที่ในช่วงนี้
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat icon={<Route className="mr-1 h-3 w-3" />} label="ระยะทาง" value={`${s.distanceKm} กม.`} />
                  <Stat icon={<Timer className="mr-1 h-3 w-3" />} label="เคลื่อนที่" value={mins(s.movingMinutes)} />
                  <Stat icon={<Timer className="mr-1 h-3 w-3" />} label="จอด" value={mins(s.stoppedMinutes)} />
                  <Stat icon={<Gauge className="mr-1 h-3 w-3" />} label="เร็วสุด" value={`${s.maxSpeedKmh} กม./ชม.`} />
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    {data?.ai ? "วิเคราะห์โดย AI" : "สรุปอัตโนมัติ"}
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{data?.brief ? linkify(data.brief) : null}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
