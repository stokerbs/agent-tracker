"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function ContentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:content:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลดคอนเทนต์ไม่สำเร็จ"
      description="เกิดข้อผิดพลาดขณะโหลดหน้านี้ ลองใหม่อีกครั้ง หากยังไม่ได้ให้ตรวจสอบว่า migration 0109 ถูกใช้งานแล้ว"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest ?? error.message}
    />
  );
}
