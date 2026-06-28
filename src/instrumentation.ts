import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEncryptionKeys } = await import("./lib/security/encryption");
    validateEncryptionKeys();
    // Sentry node init (no-op without NEXT_PUBLIC_SENTRY_DSN).
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Captures errors thrown in nested React Server Components (Next 15+).
export const onRequestError = Sentry.captureRequestError;
