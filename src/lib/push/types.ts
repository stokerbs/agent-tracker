/** Shared shape for a native push notification, sent via FCM (Android/web) or APNs (iOS). */
export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
}

/** Result of a single send: delivered, token no longer valid (prune it), or a transient failure. */
export type SendStatus = "ok" | "stale" | "error";
