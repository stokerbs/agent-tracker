"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function IdeaBankError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:ideas:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลด Idea Bank ไม่สำเร็จ"
      description="เกิดข้อผิดพลาดขณะโหลดไอเดีย ลองใหม่อีกครั้ง หากยังไม่ได้ให้ตรวจสอบว่า migration 0109 ถูกใช้กับฐานข้อมูลแล้ว"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest}
    />
  );
}
