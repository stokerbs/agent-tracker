// Sentry server-side init. Inert until NEXT_PUBLIC_SENTRY_DSN is set in the
// environment (Vercel) — `enabled: false` then sends nothing, so this is a
// no-op for local/dev and any deploy without the DSN configured.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? "development",
});
