"use client";

import { useFormStatus } from "react-dom";
import { Sparkles, Loader2 } from "lucide-react";

/** Submit button with a pending state (generation takes ~15–30s). */
export function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> กำลังให้ AI เขียน… (~20 วิ)</>
      ) : (
        <><Sparkles className="h-4 w-4" /> สร้างบทความใหม่ตอนนี้</>
      )}
    </button>
  );
}
