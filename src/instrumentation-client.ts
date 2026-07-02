// Sentry browser init. Loaded ONLY where it earns its weight: the private app
// (detectivepulse.app), NOT the public marketing site (detectivepulse.com),
// where the ~127KB / ~600ms SDK dragged the performance score. Using a dynamic
// import keeps the Sentry chunk out of the marketing bundle entirely; on the app
// it loads as soon as the module evaluates. Inert until NEXT_PUBLIC_SENTRY_DSN
// is set.
import type * as SentryType from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isMarketing =
  typeof window !== "undefined" && /^(www\.)?detectivepulse\.com$/i.test(window.location.hostname);

let sentry: typeof SentryType | null = null;

if (dsn && !isMarketing) {
  import("@sentry/nextjs")
    .then((S) => {
      sentry = S;
      S.init({
        dsn,
        enabled: true,
        tracesSampleRate: 0.1,
        // Session Replay off by default — opt in later if wanted.
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      });
    })
    .catch(() => {
      /* Sentry is best-effort — a load failure must never break the app. */
    });
}

// Instruments App Router client-side navigations. No-ops until Sentry has loaded
// (and always on the marketing site, where Sentry isn't loaded).
export function onRouterTransitionStart(
  ...args: Parameters<typeof SentryType.captureRouterTransitionStart>
): void {
  sentry?.captureRouterTransitionStart?.(...args);
}
