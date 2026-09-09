"use client";

import { useTransition } from "react";
import { toast } from "sonner";

/**
 * useTransition wrapper for server actions that THROW on auth failure
 * (requireStudioAdmin). An expired session then shows a toast instead of
 * tripping the route error boundary.
 */
export function useSafeTransition(): [boolean, (fn: () => Promise<void>) => void] {
  const [pending, start] = useTransition();
  const safe = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        console.error("[studio] action failed:", e);
        toast.error("ดำเนินการไม่สำเร็จ — อาจไม่มีสิทธิ์หรือเซสชันหมดอายุ โหลดหน้าใหม่แล้วลองอีกครั้ง");
      }
    });
  return [pending, safe];
}
