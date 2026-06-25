'use client';

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorBoundary.generic");

  useEffect(() => {
    logBoundaryError(error, "field-detail:error");
  }, [error]);

  return (
    <ErrorState
      variant="internal"
      title={t("title")}
      description={t("description")}
      resetLabel={t("reset")}
      onReset={reset}
      detail={error.digest}
    />
  );
}
