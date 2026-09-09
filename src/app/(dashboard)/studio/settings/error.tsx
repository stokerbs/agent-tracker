"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function StudioSettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:settings:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลดตั้งค่าสตูดิโอไม่สำเร็จ"
      description="อ่าน studio_settings ไม่ได้ — ตรวจสอบว่า migration 0109 ถูก apply แล้ว และบัญชีนี้เป็น admin"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest}
    />
  );
}
