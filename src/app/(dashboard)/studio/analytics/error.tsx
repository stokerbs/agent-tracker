"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function StudioAnalyticsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:analytics:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลดสถิติไม่สำเร็จ"
      description="อ่าน studio_analytics ไม่ได้ — ตรวจสอบว่า migration 0109 ถูก apply แล้ว และบัญชีนี้เป็น admin"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest}
    />
  );
}
