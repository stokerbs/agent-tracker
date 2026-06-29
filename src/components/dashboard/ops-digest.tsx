"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Period = "day" | "week";

// http(s) URLs → clickable links (Google Maps for SOS coordinates etc.).
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-500 underline underline-offset-2 break-all"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/**
 * AI Ops Digest — on-demand operations brief for the owner/supervisor.
 * Fetches /api/ops/digest, with explicit loading / error / empty states.
 */
export function OpsDigest() {
  const [period, setPeriod] = useState<Period>("day");
  const [loading, setLoading] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [isAi, setIsAi] = useState(false);
  const [error, setError] = useState(false);

  async function generate(p: Period) {
    setPeriod(p);
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/ops/digest?period=${p}`);
      if (res.status === 429) {
        toast.error("สร้างสรุปถี่เกินไป ลองใหม่อีกครั้งภายหลัง");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`(${res.status})`);
      const data = await res.json();
      setDigest(data.digest ?? "");
      setIsAi(Boolean(data.ai));
    } catch (e) {
      setError(true);
      toast.error(e instanceof Error ? `สร้างสรุปไม่สำเร็จ ${e.message}` : "สร้างสรุปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> สรุปปฏิบัติการด้วย AI
          {digest && (
            <Badge variant={isAi ? "secondary" : "outline"} className="ml-1 text-[10px]">
              {isAi ? "AI" : "สรุปอัตโนมัติ"}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1 rounded-md border border-border/60 p-0.5">
          {(["day", "week"] as const).map((p) => (
            <button
              key={p}
              onClick={() => generate(p)}
              disabled={loading}
              className={`rounded px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                period === p && digest ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {p === "day" ? "วันนี้" : "7 วัน"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Empty state — nothing generated yet */}
        {!digest && !loading && !error && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              สรุปภาพรวมคดี เหตุการณ์ SOS อุปกรณ์ GPS และเจ้าหน้าที่ด้วย AI
            </p>
            <Button size="sm" onClick={() => generate(period)} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> สร้างสรุป
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> กำลังวิเคราะห์ปฏิบัติการ…
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">สร้างสรุปไม่สำเร็จ</p>
            <Button size="sm" variant="outline" onClick={() => generate(period)} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> ลองใหม่
            </Button>
          </div>
        )}

        {/* Result */}
        {digest && !loading && (
          <div className="space-y-3">
            <div className="whitespace-pre-line text-sm leading-relaxed">{linkify(digest)}</div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => generate(period)}
              disabled={loading}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> สร้างใหม่
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
