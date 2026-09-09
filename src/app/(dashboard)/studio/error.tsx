"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลดสตูดิโอไม่สำเร็จ"
      description="เกิดข้อผิดพลาดขณะโหลดหน้านี้ ลองใหม่อีกครั้ง หากยังไม่ได้ให้ตรวจสอบการเชื่อมต่อฐานข้อมูล"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest}
    />
  );
}
