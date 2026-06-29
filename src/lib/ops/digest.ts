// AI Ops Digest — aggregate the firm's operational activity over a window
// (today / last 7 days) into a compact summary, then have Claude turn it into a
// concise Thai "operations brief" for the owner/supervisor. Pure aggregation is
// split out (summarizeOps) so it can be unit-tested without the network.

export type DigestPeriod = "day" | "week";

// ── Raw inputs (RLS-scoped rows the route fetches) ──────────────────────────
export interface RawCase {
  case_number: string | null;
  status: string;
  priority: string;
  case_type: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}
export interface RawTimeline {
  case_id: string | null;
  created_at: string;
}
export interface RawGeoEvent {
  event_type: "enter" | "exit";
  occurred_at: string;
  zone: string | null;
}
export interface RawAlert {
  status: string;
  created_at: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
}
export interface RawExpense {
  amount: number | null;
  category: string;
  expense_date: string | null;
}
export interface RawAgent {
  status: string;
}
export interface RawDevice {
  last_seen_at: string | null;
}

export interface OpsRaw {
  cases: RawCase[];
  timeline: RawTimeline[];
  geofence: RawGeoEvent[];
  alerts: RawAlert[];
  expenses: RawExpense[];
  agents: RawAgent[];
  devices: RawDevice[];
}

// ── Computed summary ────────────────────────────────────────────────────────
export interface OpsSummary {
  period: DigestPeriod;
  windowHours: number;
  cases: {
    openedInWindow: number;
    closedInWindow: number;
    currentlyOpen: number;
    currentlyActive: number;
    priorityOpen: Array<{ caseNumber: string; priority: string; caseType: string; clientName: string }>;
  };
  timeline: { entries: number; activeCases: number };
  geofence: { enters: number; exits: number; total: number; zones: Array<{ zone: string; count: number }> };
  alerts: {
    newInWindow: number;
    currentlyActive: number;
    active: Array<{ notes: string; at: string; maps: string | null }>;
  };
  expenses: { count: number; totalThb: number; byCategory: Array<{ category: string; total: number }> };
  agents: { total: number; active: number; available: number; offline: number; idle: number };
  devices: { active: number; stale: number };
}

const STALE_DEVICE_MIN = 30; // device with no fix in 30+ min is "stale"
const OPEN_STATUSES = new Set(["new", "assigned", "active", "pending"]);

function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Reduce raw operational rows to a compact, LLM-friendly summary. Pure. */
export function summarizeOps(raw: OpsRaw, period: DigestPeriod, now = new Date()): OpsSummary {
  const windowHours = period === "day" ? 24 : 24 * 7;
  const since = now.getTime() - windowHours * 3_600_000;
  const inWindow = (iso: string | null) => (iso ? Date.parse(iso) >= since : false);

  // ── Cases ────────────────────────────────────────────────────────────────
  const openedInWindow = raw.cases.filter((c) => inWindow(c.created_at)).length;
  const closedInWindow = raw.cases.filter((c) => c.status === "closed" && inWindow(c.updated_at)).length;
  const open = raw.cases.filter((c) => OPEN_STATUSES.has(c.status));
  const priorityOpen = open
    .filter((c) => c.priority === "high" || c.priority === "critical")
    .sort((a, b) => (a.priority === "critical" ? -1 : 1) - (b.priority === "critical" ? -1 : 1))
    .slice(0, 8)
    .map((c) => ({
      caseNumber: c.case_number ?? "—",
      priority: c.priority,
      caseType: c.case_type ?? "—",
      clientName: c.client_name ?? "—",
    }));

  // ── Timeline ───────────────────────────────────────────────────────────────
  const tlInWindow = raw.timeline.filter((t) => inWindow(t.created_at));
  const activeCases = new Set(tlInWindow.map((t) => t.case_id).filter(Boolean)).size;

  // ── Geofence crossings ─────────────────────────────────────────────────────
  const geoInWindow = raw.geofence.filter((g) => inWindow(g.occurred_at));
  const zoneCount = new Map<string, number>();
  for (const g of geoInWindow) {
    const z = g.zone ?? "ไม่ทราบโซน";
    zoneCount.set(z, (zoneCount.get(z) ?? 0) + 1);
  }
  const zones = Array.from(zoneCount.entries())
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Emergency / SOS ──────────────────────────────────────────────────────
  const newAlerts = raw.alerts.filter((a) => inWindow(a.created_at)).length;
  const activeAlerts = raw.alerts.filter((a) => a.status !== "resolved");
  const active = activeAlerts.slice(0, 5).map((a) => ({
    notes: a.notes ?? "SOS",
    at: a.created_at,
    maps: a.lat != null && a.lng != null ? mapsLink(a.lat, a.lng) : null,
  }));

  // ── Expenses ─────────────────────────────────────────────────────────────
  const expInWindow = raw.expenses.filter((e) => inWindow(e.expense_date));
  const catTotals = new Map<string, number>();
  let totalThb = 0;
  for (const e of expInWindow) {
    const amt = e.amount ?? 0;
    totalThb += amt;
    catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + amt);
  }
  const byCategory = Array.from(catTotals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ── Agents ─────────────────────────────────────────────────────────────────
  const agentStatus = (s: string) => raw.agents.filter((a) => a.status === s).length;

  // ── Devices ────────────────────────────────────────────────────────────────
  const staleSince = now.getTime() - STALE_DEVICE_MIN * 60_000;
  let active_devices = 0;
  let stale = 0;
  for (const d of raw.devices) {
    if (!d.last_seen_at) continue;
    if (Date.parse(d.last_seen_at) >= staleSince) active_devices++;
    else stale++;
  }

  return {
    period,
    windowHours,
    cases: {
      openedInWindow,
      closedInWindow,
      currentlyOpen: open.length,
      currentlyActive: raw.cases.filter((c) => c.status === "active").length,
      priorityOpen,
    },
    timeline: { entries: tlInWindow.length, activeCases },
    geofence: {
      enters: geoInWindow.filter((g) => g.event_type === "enter").length,
      exits: geoInWindow.filter((g) => g.event_type === "exit").length,
      total: geoInWindow.length,
      zones,
    },
    alerts: { newInWindow: newAlerts, currentlyActive: activeAlerts.length, active },
    expenses: { count: expInWindow.length, totalThb: Math.round(totalThb), byCategory },
    agents: {
      total: raw.agents.length,
      active: raw.agents.filter((a) => a.status !== "offline").length,
      available: ["online", "moving", "idle"].reduce((n, s) => n + agentStatus(s), 0),
      offline: agentStatus("offline"),
      idle: agentStatus("idle"),
    },
    devices: { active: active_devices, stale },
  };
}

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";

const thb = (n: number) => `฿${n.toLocaleString("en-US")}`;
const periodLabel = (p: DigestPeriod) => (p === "day" ? "วันนี้ (24 ชม.ล่าสุด)" : "7 วันล่าสุด");

/** Deterministic fallback when AI is unavailable — still useful on its own. */
export function templateDigest(s: OpsSummary): string {
  const lines = [
    `สรุปปฏิบัติการ — ${periodLabel(s.period)}`,
    `• คดี: เปิดใหม่ ${s.cases.openedInWindow} · ปิด ${s.cases.closedInWindow} · กำลังดำเนินการ ${s.cases.currentlyActive} · เปิดค้างทั้งหมด ${s.cases.currentlyOpen}`,
    `• บันทึกไทม์ไลน์ ${s.timeline.entries} รายการ ใน ${s.timeline.activeCases} คดี`,
    `• Geofence: เข้า ${s.geofence.enters} · ออก ${s.geofence.exits}`,
    `• SOS: ใหม่ ${s.alerts.newInWindow} · ค้างอยู่ ${s.alerts.currentlyActive}`,
    `• ค่าใช้จ่าย ${s.expenses.count} รายการ รวม ${thb(s.expenses.totalThb)}`,
    `• เจ้าหน้าที่: ออนไลน์ ${s.agents.active}/${s.agents.total} · ว่าง ${s.agents.available} · ออฟไลน์ ${s.agents.offline}`,
    `• อุปกรณ์ GPS: ส่งสัญญาณปกติ ${s.devices.active} · ขาดสัญญาณ ${s.devices.stale}`,
  ];
  if (s.cases.priorityOpen.length) {
    lines.push("คดีสำคัญที่ต้องจับตา:");
    s.cases.priorityOpen.slice(0, 5).forEach((c) =>
      lines.push(`  • ${c.caseNumber} (${c.priority}) — ${c.caseType} / ${c.clientName}`),
    );
  }
  if (s.alerts.active.length) {
    lines.push("SOS ที่ยังไม่ปิด:");
    s.alerts.active.forEach((a) => lines.push(`  • ${a.notes}${a.maps ? ` — ${a.maps}` : ""}`));
  }
  return lines.join("\n");
}

/** Compose the digest via Claude; falls back to a clean template on any failure. */
export async function buildOpsDigest(
  summary: OpsSummary,
): Promise<{ digest: string; ai: boolean }> {
  const fallback = templateDigest(summary);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { digest: fallback, ai: false };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1400,
        messages: [
          {
            role: "user",
            content:
              `คุณเป็นหัวหน้าศูนย์ปฏิบัติการของหน่วยสืบสวนเอกชน เขียน "สรุปภาพรวมปฏิบัติการ" ภาษาไทยให้ผู้บริหาร ` +
              `กระชับ เป็นมืออาชีพ จากข้อมูลสรุปช่วง ${periodLabel(summary.period)} ต่อไปนี้ (JSON):\n\n` +
              JSON.stringify(summary) +
              `\n\nรูปแบบผลลัพธ์:\n` +
              `1) ย่อหน้าภาพรวม 2-3 ประโยค (สถานการณ์โดยรวมของวันนี้/สัปดาห์)\n` +
              `2) หัวข้อ "สิ่งที่ต้องสนใจ" — bullet 3-5 ข้อ จัดลำดับความสำคัญ: SOS ค้าง > คดี critical/high > อุปกรณ์ขาดสัญญาณ > คดีเงียบไม่มีบันทึก\n` +
              `3) หัวข้อ "ตัวเลขสำคัญ" — bullet สั้นๆ ของคดี/ไทม์ไลน์/ค่าใช้จ่าย/เจ้าหน้าที่\n` +
              `กฎสำคัญ: ถ้าอ้างถึงพิกัด/ตำแหน่ง (เช่น SOS ที่มีฟิลด์ "maps") ต้องแนบลิงก์ Google Maps นั้นตามจริง ห้ามแต่ง URL เอง.\n` +
              `ใช้สกุลเงินบาท (฿). ห้ามแต่งตัวเลขที่ไม่มีใน JSON. ถ้าหมวดใดเป็น 0 ไม่ต้องเน้น. เขียนให้จบสมบูรณ์ ตอบเฉพาะรายงาน.`,
          },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[ops-digest] Anthropic error:", res.status);
      return { digest: fallback, ai: false };
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text?.trim();
    return text ? { digest: text, ai: true } : { digest: fallback, ai: false };
  } catch (e) {
    console.error("[ops-digest] AI digest failed, using template:", e instanceof Error ? e.message : e);
    return { digest: fallback, ai: false };
  }
}
