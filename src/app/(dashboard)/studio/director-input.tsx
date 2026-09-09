"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["5 คลิป TikTok เรื่องนอกใจ", "อธิบาย GPS ให้ลูกค้าเข้าใจ", "Case story 3 เรื่องสำหรับ IG"];

/**
 * The dashboard's headline control: a single brief that hands off to the
 * Creative Director. Navigation only — no AI runs here, so it works (and
 * still routes) when the provider is unavailable; the director page explains.
 */
export function DirectorInput({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    startTransition(() => router.push(`/studio/director?q=${encodeURIComponent(trimmed)}`));
  };

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className={cn(
          "group flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 p-2 pl-4 shadow-sm backdrop-blur transition-all",
          "focus-within:border-primary/50 focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/15",
        )}
      >
        <Sparkles className={cn("h-5 w-5 shrink-0 transition-colors", aiAvailable ? "text-primary" : "text-muted-foreground/60")} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="สร้าง content สัปดาห์หน้า เน้น TikTok…"
          aria-label="บรีฟ Creative Director"
          maxLength={500}
          disabled={pending}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/60 md:text-lg"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-all",
            "hover:bg-primary/90 disabled:opacity-40",
          )}
        >
          <span className="hidden sm:inline">วางแผน</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">ลองเริ่มจาก</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => go(s)}
            className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
