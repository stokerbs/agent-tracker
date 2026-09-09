"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function KnowledgeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:knowledge:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลดคลังความรู้ไม่สำเร็จ"
      description="เกิดข้อผิดพลาดขณะโหลดคลังความรู้หรือคำถามลูกค้า ลองใหม่อีกครั้ง"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest}
    />
  );
}
