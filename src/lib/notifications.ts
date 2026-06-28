import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push/send";
import { notificationLinks, relProfileId } from "@/lib/notification-links";
import type { NotificationType } from "@/lib/types";

// Re-export the pure helpers so feature code keeps a single import surface
// (`@/lib/notifications`) for the whole notification system.
export { notificationLinks, relProfileId };

/**
 * THE notification pipeline. Every notification in Detective Pulse flows through
 * this module — there is exactly one place that creates notification records,
 * builds payloads + deep links, fans out push, and logs delivery. No feature may
 * insert into `public.notifications` or call the push layer directly.
 *
 *   application event → notifyUsers() → insert notification → sendPushToUsers() → APNs / FCM
 *
 * SEC-5: this is a `server-only` internal module, NOT a "use server" action file
 * (which would expose these RLS-bypassing writes as callable endpoints).
 */

export type NotificationPriority = "high" | "normal";

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  /** Canonical in-app destination path — build it via `notificationLinks`, never inline. */
  url?: string;
  /** @deprecated alias for `url`, kept for back-compat. */
  link?: string;
  /** Primary entity the notification refers to (case id, alert id, …). */
  entityId?: string;
  /** Delivery urgency. Defaults to "normal"; emergencies use "high". */
  priority?: NotificationPriority;
}

/**
 * Insert a notification for each of the given user IDs and fan out to native
 * devices. Fire-and-forget safe: dedupes recipients, never throws, no-ops on an
 * empty audience. The DB row stores type/title/body/link; the richer push
 * payload (type, entityId, priority, createdAt) rides along to APNs/FCM only.
 */
/**
 * Persistence concern: write one in-app `notifications` row per recipient.
 * Returns false (and logs) on DB error so the orchestrator can skip transport.
 * (Transport — native push — is the separate `sendPushToUsers` module.)
 */
async function persistNotifications(
  ids: string[],
  notification: NotifyInput,
  url: string | null,
): Promise<boolean> {
  const client = createServiceClient();
  const { error } = await client.from("notifications").insert(
    ids.map((user_id) => ({
      user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      link: url,
    })),
  );
  if (error) {
    console.error(`[notification] insert failed type=${notification.type}: ${error.message}`);
    return false;
  }
  return true;
}

export async function notifyUsers(
  userIds: string[],
  notification: NotifyInput,
): Promise<void> {
  try {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return;

    const url = notification.url ?? notification.link ?? null;
    const priority = notification.priority ?? "normal";
    const createdAt = new Date().toISOString();

    // 1. Persistence — the in-app record. Bail before transport if it fails.
    const persisted = await persistNotifications(ids, notification, url);
    if (!persisted) return;
    console.log(
      `[notification] type=${notification.type} recipients=${ids.length} priority=${priority} url=${url ?? "-"}`,
    );

    // 2. Transport — fan out to native devices (no-op when push isn't configured
    // / no tokens). Awaited so push completes within the caller's request —
    // callers `await` the notify* chain, so delivery is guaranteed before the
    // action returns (do NOT use `after()` here: it does not flush for Server
    // Actions on Vercel).
    await sendPushToUsers(ids, {
      title: notification.title,
      body: notification.body,
      url: url ?? undefined,
      type: notification.type,
      entityId: notification.entityId,
      priority,
      createdAt,
    });
  } catch (err) {
    // Notifications are best-effort — never let them abort the triggering action.
    console.error("[notification] notifyUsers error", err);
  }
}

/**
 * Notify all active users with any of the given roles.
 * Pass `excludeId` to skip the actor (e.g. don't ping the person who triggered the event).
 */
export async function notifyRole(
  roles: string[],
  notification: NotifyInput,
  excludeId?: string,
): Promise<void> {
  try {
    const client = createServiceClient();
    const { data } = await client
      .from("profiles")
      .select("id")
      .in("role", roles)
      .eq("is_active", true);
    const ids = (data ?? [])
      .map((p: { id: string }) => p.id)
      .filter((id) => id !== excludeId);
    await notifyUsers(ids, notification);
  } catch (err) {
    console.error("[notification] notifyRole error", err);
  }
}

// ── Case-scoped recipients ───────────────────────────────────────────────────

export interface CaseRecipients {
  /** Login profile ids of agents currently assigned to the case. */
  agents: string[];
  /** The case client's portal profile id, if they have a login. */
  client: string | null;
}

/**
 * Resolve who should hear about a case event: the assigned agents (with a linked
 * login) plus the case's client. `exclude` drops the actor so they aren't pinged
 * for their own action. Single source of truth for case audiences.
 */
export async function getCaseRecipients(
  caseId: string,
  opts?: { exclude?: string },
): Promise<CaseRecipients> {
  try {
    const client = createServiceClient();
    const [linksRes, caseRes] = await Promise.all([
      client.from("case_agents").select("agents(profile_id)").eq("case_id", caseId),
      client.from("cases").select("clients(profile_id)").eq("id", caseId).maybeSingle(),
    ]);

    const exclude = opts?.exclude;
    const agents = [
      ...new Set(
        (linksRes.data ?? [])
          .map((r) => relProfileId(r.agents))
          .filter((id): id is string => !!id),
      ),
    ].filter((id) => id !== exclude);

    const clientProfileId = relProfileId(caseRes.data?.clients);
    const clientId = clientProfileId && clientProfileId !== exclude ? clientProfileId : null;

    return { agents, client: clientId };
  } catch (err) {
    // Best-effort: a resolution failure must never reject into a void caller.
    console.error("[notification] getCaseRecipients error", err);
    return { agents: [], client: null };
  }
}

/**
 * Fan a case event out to its participants through the one pipeline: assigned
 * agents are linked into the staff app (`/cases/:id`) and the client into the
 * portal (`/portal/cases/:id`). Links + audiences are resolved here so feature
 * code never rebuilds either. `exclude` skips the actor; set `includeClient:
 * false` for staff-internal events.
 */
export async function notifyCaseParticipants(
  caseId: string,
  input: {
    type: NotificationType;
    title: string;
    body?: string;
    priority?: NotificationPriority;
    exclude?: string;
    includeClient?: boolean;
  },
): Promise<void> {
  const { agents, client } = await getCaseRecipients(caseId, { exclude: input.exclude });

  await notifyUsers(agents, {
    type: input.type,
    title: input.title,
    body: input.body,
    url: notificationLinks.case(caseId),
    entityId: caseId,
    priority: input.priority,
  });

  if (input.includeClient !== false && client) {
    await notifyUsers([client], {
      type: input.type,
      title: input.title,
      body: input.body,
      url: notificationLinks.portalCase(caseId),
      entityId: caseId,
      priority: input.priority,
    });
  }
}
