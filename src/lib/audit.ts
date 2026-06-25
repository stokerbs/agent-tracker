import { createServiceClient } from "@/lib/supabase/server";

/**
 * Writes a single audit_logs entry for a privileged server-side mutation.
 *
 * Non-fatal by design: an audit-write failure is logged via console.error and
 * swallowed so it can never break the business flow it accompanies. Mirrors the
 * inline LOGIN audit insert in src/app/(auth)/actions.ts.
 *
 * Note: ip_address is intentionally not set here — these config/mutation actions
 * have no request IP in scope. Never pass secrets (passwords, *_enc values) in
 * metadata.
 */
export async function logAudit({
  actorId,
  action,
  entity,
  entityId,
  metadata,
}: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId ?? null,
      metadata: metadata ?? null,
    });
  } catch (auditErr) {
    console.error("[audit] log failed:", action, entity, auditErr);
  }
}
