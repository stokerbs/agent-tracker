'use client';

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { logBoundaryError } from "@/lib/errors";

/**
 * Global error boundary. This replaces the root layout when the layout itself
 * fails, so it must render its own <html>/<body> and cannot rely on the
 * next-intl provider (no provider context exists here). Copy is intentionally
 * hardcoded, short and neutral: this boundary must never itself throw, so it
 * avoids every extra dependency (i18n hooks, message loading, etc.).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logBoundaryError(error, "app:global-error");
  }, [error]);

  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <ErrorState
          variant="internal"
          title="Something went wrong"
          description="An unexpected error occurred. Please try again."
          resetLabel="Try again"
          onReset={reset}
          detail={error.digest}
        />
      </body>
    </html>
  );
}
