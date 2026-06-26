"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { notifyUsers, notificationLinks, relProfileId } from "@/lib/notifications";
import type { PayrollStatus } from "@/lib/types";
import { bangkokDateKey } from "@/lib/utils";

function bangkokToday(): string {
  return bangkokDateKey();
}

export async function createPayment(formData: FormData) {
  const profile = await requireStaff();

  const supabase = await createClient();
  const { error } = await supabase.from("agent_payments").insert({
    agent_id: formData.get("agent_id") as string,
    case_id: (formData.get("case_id") as string) || null,
    work_date: (formData.get("work_date") as string) || bangkokToday(),
    amount: parseFloat(formData.get("amount") as string),
    currency: "THB",
    notes: (formData.get("notes") as string) || null,
    status: "pending",
    created_by: profile.id,
  });
  if (error) throw new Error(handleDbError(error, "payroll"));

  revalidatePath("/payroll");
}

export async function updatePaymentStatus(id: string, status: PayrollStatus) {
  const profile = await requireStaff();

  const supabase = await createClient();
  const update: Record<string, unknown> = { status };
  if (status === "paid") {
    update.paid_at = new Date().toISOString();
    update.paid_by = profile.id;
  }

  const { error } = await supabase.from("agent_payments").update(update).eq("id", id);
  if (error) throw new Error(handleDbError(error, "payroll"));

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: `payroll.status.${status}`,
    entity: "agent_payments",
    entity_id: id,
    metadata: { status },
  });

  if (status === "paid") {
    const { data: row } = await supabase
      .from("agent_payments")
      .select("amount, agents(profile_id)")
      .eq("id", id)
      .maybeSingle();
    const recipient = relProfileId(row?.agents);
    if (recipient) {
      await notifyUsers([recipient], {
        type: "system",
        title: "Payment issued",
        body: `A payment of ${Number(row?.amount ?? 0).toLocaleString()} THB has been marked paid.`,
        url: notificationLinks.payroll(),
        entityId: id,
      });
    }
  }

  revalidatePath("/payroll");
}

export async function adjustPayment(id: string, newAmount: number, reason: string) {
  const profile = await requireStaff();

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("agent_payments")
    .select("amount, status")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("agent_payments")
    .update({ amount: newAmount, status: "adjusted" })
    .eq("id", id);
  if (error) throw new Error(handleDbError(error, "payroll"));

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "payroll.adjust",
    entity: "agent_payments",
    entity_id: id,
    metadata: {
      previous_amount: existing?.amount,
      new_amount: newAmount,
      previous_status: existing?.status,
      reason,
    },
  });

  revalidatePath("/payroll");
}

export async function bulkMarkPaid(ids: string[]) {
  if (!ids.length) return;
  const profile = await requireStaff();

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("agent_payments")
    .update({ status: "paid", paid_at: now, paid_by: profile.id })
    .in("id", ids);
  if (error) throw new Error(handleDbError(error, "payroll"));

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "payroll.bulk_paid",
    entity: "agent_payments",
    entity_id: null,
    metadata: { ids, count: ids.length },
  });

  // Notify each affected agent once (a single payment notice per recipient).
  const { data: rows } = await supabase
    .from("agent_payments")
    .select("agents(profile_id)")
    .in("id", ids);
  const recipients = [
    ...new Set(
      (rows ?? [])
        .map((r) => relProfileId(r.agents))
        .filter((p): p is string => !!p),
    ),
  ];
  for (const recipient of recipients) {
    await notifyUsers([recipient], {
      type: "system",
      title: "Payment issued",
      body: "One or more payments have been marked paid.",
      url: notificationLinks.payroll(),
    });
  }

  revalidatePath("/payroll");
}

export async function deletePayment(id: string) {
  const profile = await requireStaff();

  const supabase = await createClient();
  const { error } = await supabase.from("agent_payments").delete().eq("id", id);
  if (error) throw new Error(handleDbError(error, "payroll"));

  revalidatePath("/payroll");
}
