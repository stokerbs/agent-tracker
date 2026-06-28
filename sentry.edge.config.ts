// Sentry edge-runtime init (middleware, edge routes). Inert until
// NEXT_PUBLIC_SENTRY_DSN is set — see sentry.server.config.ts.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? "development",
});
