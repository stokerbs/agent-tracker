import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FadeUp } from "@/components/shared/motion";
import { FieldHome, type MenuCard } from "@/components/field/field-home";
import type { Agent } from "@/lib/types";

export const metadata: Metadata = { title: "Field" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  agent: "ภาคสนาม",
  supervisor: "หัวหน้าชุด",
  admin: "ผู้ดูแล",
  client: "ลูกค้า",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Field home — the nav rendered as a card launcher (Card Menu, Variation B).
 * Real profile + live counts for the signed-in agent; each card links to its
 * real route. The on-duty operational screen lives at /field/duty.
 */
export default async function FieldPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: agentRaw } = await supabase
    .from("agents")
    .select("id, agent_code, full_name, status")
    .eq("profile_id", profile.id)
    .maybeSingle();
  const agent = agentRaw as Pick<Agent, "id" | "agent_code" | "full_name" | "status"> | null;

  // Live counts scoped to the agent's active cases.
  let openCases = 0;
  let evidenceCount = 0;
  let timelineCount = 0;

  if (agent) {
    const { data: ca } = await supabase
      .from("case_agents")
      .select("cases(id, status)")
      .eq("agent_id", agent.id);

    const caseIds = (ca ?? [])
      .map((r: any) => r.cases)
      .filter((c: any) => c && c.status !== "closed" && c.status !== "cancelled")
      .map((c: any) => c.id as string);
    openCases = caseIds.length;

    if (caseIds.length > 0) {
      const [{ count: ev }, { count: tl }] = await Promise.all([
        supabase.from("evidence").select("id", { count: "exact", head: true }).in("case_id", caseIds),
        supabase.from("timeline_entries").select("id", { count: "exact", head: true }).in("case_id", caseIds),
      ]);
      evidenceCount = ev ?? 0;
      timelineCount = tl ?? 0;
    }
  }

  const name = agent?.full_name || profile.full_name || "Agent";
  const firstName = name.trim().split(/\s+/)[0];
  const meta = `${agent?.agent_code ?? "DP-000"} · ${ROLE_LABEL[profile.role] ?? profile.role}`;

  const ops: MenuCard[] = [
    { icon: "layout-dashboard", label: "แดชบอร์ด", sub: "ภาพรวมวันนี้", accent: "hsl(var(--primary))", href: "/dashboard" },
    { icon: "radio", label: "แอปภาคสนาม", sub: "ปฏิบัติการ", accent: "hsl(var(--primary))", href: "/field/duty", active: true },
    { icon: "navigation", label: "ติดตาม GPS", sub: "ตำแหน่งหน่วย", accent: "hsl(var(--status-moving))", href: "/gps-monitor" },
    { icon: "briefcase", label: "คดี", sub: openCases > 0 ? `${openCases} คดีเปิด` : "ไม่มีคดีเปิด", accent: "hsl(var(--prio-high))", href: "/cases" },
    { icon: "clock", label: "ไทม์ไลน์", sub: `${timelineCount} เหตุการณ์`, accent: "hsl(var(--prio-medium))", href: "/timeline" },
  ];
  const field: MenuCard[] = [
    { icon: "folder-lock", label: "หลักฐาน", sub: `${evidenceCount} ไฟล์`, accent: "hsl(var(--prio-medium))", href: "/evidence" },
    { icon: "file-text", label: "รายงาน", sub: "รายงานคดี", accent: "hsl(var(--primary))", href: "/reports" },
    { icon: "receipt", label: "ค่าใช้จ่าย", sub: "บันทึกค่าใช้จ่าย", accent: "hsl(var(--success))", href: "/expenses" },
    { icon: "wallet", label: "เงินเดือน", sub: "รอบเดือนนี้", accent: "hsl(var(--status-online))", href: "/payroll" },
  ];

  return (
    <FadeUp className="pb-4">
      <FieldHome
        initials={initialsOf(name)}
        greeting={`สวัสดี, ${firstName}`}
        meta={meta}
        statusLabel="ปฏิบัติงาน"
        ops={ops}
        field={field}
      />
    </FadeUp>
  );
}
