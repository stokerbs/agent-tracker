import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Honest AI availability banner. Rendered by pages that offer AI actions when
 * the provider cannot run (missing key / unsupported provider) — the buttons
 * still render disabled so the owner understands why nothing happens.
 */
export function AiUnavailableBanner({ reason, className }: { reason?: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm", className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p className="font-medium text-amber-700 dark:text-amber-300">AI ยังใช้งานไม่ได้</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {reason ?? "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บนเซิร์ฟเวอร์ หรือเลือก provider ที่ยังไม่รองรับ"} —{" "}
          <Link href="/studio/settings" className="text-primary hover:underline">
            ตรวจสอบตั้งค่าสตูดิโอ
          </Link>
          . ฟีเจอร์ที่ไม่ใช้ AI (คลังความรู้, ปฏิทิน, แก้ไขคอนเทนต์ด้วยมือ) ใช้งานได้ตามปกติ
        </p>
      </div>
    </div>
  );
}

export function AiModelTag({ model, className }: { model: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-600 dark:text-violet-400", className)}>
      <Sparkles className="h-3 w-3" /> {model}
    </span>
  );
}
