"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push/send";
import type { NotificationType } from "@/lib/types";

interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/** Insert a notification for each of the given user IDs. Fire-and-forget safe. */
export async function notifyUsers(
  userIds: string[],
  notification: NotifyInput,
): Promise<void> {
  if (!userIds.length) return;
  const client = createServiceClient();
  await client.from("notifications").insert(
    userIds.map((user_id) => ({
      user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      link: notification.link ?? null,
    })),
  );

  // Fan out to native devices via FCM (no-op when push isn't configured).
  void sendPushToUsers(userIds, {
    title: notification.title,
    body: notification.body,
    link: notification.link,
  });
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
}
