// Sentry browser init. Inert until NEXT_PUBLIC_SENTRY_DSN is set — `enabled:
// false` then collects/sends nothing.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  // Session Replay off by default — opt in later if wanted.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
});

// Instruments App Router client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
