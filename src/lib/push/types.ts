/** Shared shape for a native push notification, sent via FCM (Android/web) or APNs (iOS). */
export interface PushPayload {
  title: string;
  body?: string;
  /** In-app destination path, e.g. "/cases/abc". Preferred over `link`. */
  url?: string;
  /** Notification category, e.g. "case_assignment" | "invoice" | "emergency". */
  type?: string;
  /** Primary entity id the notification refers to (case id, invoice id, …). */
  entityId?: string;
  /** @deprecated Use `url`. Kept so existing callers keep working. */
  link?: string;
}

/**
 * Build the string→string `data` map attached to the push (APNs custom keys /
 * FCM `message.data`). Single source of truth so APNs and FCM stay identical.
 * The tap/foreground handlers read `data.url` (falling back to `data.link`).
 */
export function notificationData(p: PushPayload): Record<string, string> {
  const data: Record<string, string> = {};
  const url = p.url ?? p.link;
  if (url) {
    data.url = url;
    data.link = url; // back-compat with the existing tap handler
  }
  if (p.type) data.type = p.type;
  if (p.entityId) data.entityId = p.entityId;
  return data;
}

/** Result of a single send: delivered, token no longer valid (prune it), or a transient failure. */
export type SendStatus = "ok" | "stale" | "error";
