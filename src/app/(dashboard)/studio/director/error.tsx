"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function DirectorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:director:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลด Creative Director ไม่สำเร็จ"
      description="เกิดข้อผิดพลาดขณะโหลดหน้านี้ ลองใหม่อีกครั้ง หากยังไม่ได้ให้ตรวจสอบการเชื่อมต่อฐานข้อมูลและตั้งค่าสตูดิโอ"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest}
    />
  );
}
