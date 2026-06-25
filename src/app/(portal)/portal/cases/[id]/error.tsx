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
  const t = useTranslations("errorBoundary.portal");

  useEffect(() => {
    logBoundaryError(error, "portal:cases-detail:error");
  }, [error]);

  return (
    <ErrorState
      variant="portal"
      title={t("title")}
      description={t("description")}
      resetLabel={t("reset")}
      onReset={reset}
    />
  );
}
