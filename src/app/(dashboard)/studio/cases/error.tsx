"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function StudioCasesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logBoundaryError(error, "studio:cases:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title="โหลด Case Insights ไม่สำเร็จ"
      description="เกิดข้อผิดพลาดขณะโหลดเคสหรือบทเรียน ลองใหม่อีกครั้ง"
      resetLabel="ลองใหม่"
      onReset={reset}
      detail={error.digest}
    />
  );
}
