// AI Anomaly Watch — proactively scan a tracked device's recent GPS behaviour
// against its own 2-week baseline and flag surveillance-relevant anomalies:
//   • new-location   — dwelled somewhere it has never been before
//   • night-activity — moving at 00:00–05:00 when it normally doesn't
//   • went-dark      — a normally-reporting device stopped sending fixes
//
// Detection is pure (detectAnomalies) so it is fully unit-testable; Claude is
// used only to phrase the alert, with a deterministic template fallback.

export interface Fix {
  lat: number;
  lng: number;
  speed: number; // km/h
  t: string; // recorded_at ISO (UTC)
}

export type AnomalyKind = "new-location" | "night-activity" | "went-dark";

export interface AnomalySignal {
  kind: AnomalyKind;
  detail: string; // short Thai phrase
  lat?: number;
  lng?: number;
  maps?: string; // prebuilt Google Maps link (never let the model invent URLs)
  at?: string; // ISO
}

export interface AnomalyResult {
  signals: AnomalySignal[];
  /** Stable id of the current anomaly set — used to dedupe re-notification. */
  signature: string;
}

const DARK_MIN = 120; // device silent ≥ 2h → "went dark"
const BASELINE_MIN_FIXES = 50; // only trust baseline-relative signals above this
const NEW_LOC_KM = 1.0; // dwell ≥ 1km from every known place = new location
const STOP_SPEED = 3; // ≤ this km/h counts as a dwell fix
const MOVE_SPEED = 8; // > this km/h counts as real movement (ignore jitter)
const NIGHT_START = 0;
const NIGHT_END = 5; // [00:00, 05:00) Thai local
const NIGHT_MIN_FIXES = 3;
const GRID = 0.01; // ~1.1km baseline grid cell

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const mapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

/** Hour of day in Thai local time (UTC+7) for an ISO timestamp. */
function thaiHour(iso: string): number {
  return ((new Date(Date.parse(iso) + 7 * 3_600_000).getUTCHours()) + 24) % 24;
}
const isNight = (h: number) => h >= NIGHT_START && h < NIGHT_END;

/** Reduce baseline fixes to a small set of place centroids (grid-cell centres). */
function baselinePlaces(baseline: Fix[]): Array<{ lat: number; lng: number }> {
  const cells = new Map<string, { lat: number; lng: number }>();
  for (const f of baseline) {
    const key = `${Math.round(f.lat / GRID)},${Math.round(f.lng / GRID)}`;
    if (!cells.has(key)) cells.set(key, { lat: f.lat, lng: f.lng });
  }
  return [...cells.values()];
}

export function detectAnomalies(opts: {
  baseline: Fix[];
  recent: Fix[];
  lastSeenAt: string | null;
  now?: Date;
}): AnomalyResult {
  const now = opts.now ?? new Date();
  const signals: AnomalySignal[] = [];
  const trustBaseline = opts.baseline.length >= BASELINE_MIN_FIXES;

  // ── went-dark ──────────────────────────────────────────────────────────────
  // Only meaningful if the device normally reports (baseline present).
  if (trustBaseline && opts.lastSeenAt) {
    const silentMin = (now.getTime() - Date.parse(opts.lastSeenAt)) / 60000;
    if (silentMin >= DARK_MIN) {
      signals.push({
        kind: "went-dark",
        detail: `อุปกรณ์ขาดการส่งสัญญาณ ~${Math.round(silentMin / 60)} ชม. (ปกติส่งต่อเนื่อง) — อาจถูกถอด/ปิด/อยู่นอกพื้นที่`,
        at: opts.lastSeenAt,
      });
    }
  }

  // ── new-location ─────────────────────────────────────────────────────────
  if (trustBaseline) {
    const places = baselinePlaces(opts.baseline);
    const dwell = opts.recent.filter((f) => f.speed <= STOP_SPEED);
    let farthest: { fix: Fix; km: number } | null = null;
    for (const f of dwell) {
      let min = Infinity;
      for (const p of places) min = Math.min(min, haversineKm(f.lat, f.lng, p.lat, p.lng));
      if (min > NEW_LOC_KM && (!farthest || min > farthest.km)) farthest = { fix: f, km: min };
    }
    if (farthest) {
      const { fix, km } = farthest;
      signals.push({
        kind: "new-location",
        detail: `พบการหยุดอยู่ในสถานที่ใหม่ที่ไม่เคยปรากฏใน 14 วันก่อนหน้า (ห่างจุดเดิม ~${km.toFixed(1)} กม.)`,
        lat: fix.lat,
        lng: fix.lng,
        maps: mapsLink(fix.lat, fix.lng),
        at: fix.t,
      });
    }
  }

  // ── night-activity ─────────────────────────────────────────────────────────
  const recentNight = opts.recent.filter((f) => f.speed > MOVE_SPEED && isNight(thaiHour(f.t)));
  const baselineNight = opts.baseline.filter((f) => f.speed > MOVE_SPEED && isNight(thaiHour(f.t)));
  if (recentNight.length >= NIGHT_MIN_FIXES && baselineNight.length === 0) {
    const rep = recentNight[recentNight.length - 1];
    signals.push({
      kind: "night-activity",
      detail: `ตรวจพบการเคลื่อนไหวช่วงกลางคืน (00:00–05:00) ผิดปกติ ${recentNight.length} จุด ขณะที่ปกติไม่มีการเคลื่อนไหวช่วงนี้`,
      lat: rep.lat,
      lng: rep.lng,
      maps: mapsLink(rep.lat, rep.lng),
      at: rep.t,
    });
  }

  // ── signature (dedup key) ────────────────────────────────────────────────
  const sigPart = (s: AnomalySignal): string => {
    switch (s.kind) {
      case "new-location":
        return `nl:${s.lat?.toFixed(2)},${s.lng?.toFixed(2)}`;
      // Night activity keyed by Thai calendar date so each new night re-alerts.
      case "night-activity":
        return `na:${new Date(Date.parse(s.at!) + 7 * 3_600_000).toISOString().slice(0, 10)}`;
      // Persists while dark; clears when the device reports again → re-alerts next time.
      case "went-dark":
        return "dark";
    }
  };
  const signature = signals.map(sigPart).sort().join("|");

  return { signals, signature };
}

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";

/** Deterministic fallback — concise, still includes the maps links. */
export function templateAlert(deviceLabel: string, signals: AnomalySignal[]): string {
  const head = `⚠️ ${deviceLabel}: ตรวจพบความผิดปกติ ${signals.length} รายการ`;
  const lines = signals.map((s) => `• ${s.detail}${s.maps ? ` — ${s.maps}` : ""}`);
  return [head, ...lines].join("\n");
}

/** Phrase the anomaly alert via Claude; falls back to the template on any failure. */
export async function buildAnomalyAlert(
  deviceLabel: string,
  signals: AnomalySignal[],
): Promise<{ text: string; ai: boolean }> {
  const fallback = templateAlert(deviceLabel, signals);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || signals.length === 0) return { text: fallback, ai: false };

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
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content:
              `คุณเป็นนักวิเคราะห์ข่าวกรองของหน่วยสืบสวน เขียน "การแจ้งเตือนความผิดปกติ" ภาษาไทยสั้นกระชับ (2-4 ประโยค) ` +
              `จากสัญญาณที่ตรวจพบของอุปกรณ์ติดตาม "${deviceLabel}" ต่อไปนี้ (JSON):\n\n` +
              JSON.stringify(signals) +
              `\n\nกฎ: เรียงตามความสำคัญ (ขาดสัญญาณ/สถานที่ใหม่ สำคัญสุด). ` +
              `ถ้าสัญญาณใดมีฟิลด์ "maps" ต้องแนบลิงก์ Google Maps นั้นตามจริง ห้ามแต่ง URL เอง. ` +
              `ใช้เวลาโซนไทย (ค่าใน JSON เป็น UTC ให้ +7). ห้ามแต่งข้อมูลที่ไม่มีใน JSON. ตอบเฉพาะข้อความแจ้งเตือน.`,
          },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[anomaly-watch] Anthropic error:", res.status);
      return { text: fallback, ai: false };
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text?.trim();
    return text ? { text, ai: true } : { text: fallback, ai: false };
  } catch (e) {
    console.error("[anomaly-watch] AI alert failed, using template:", e instanceof Error ? e.message : e);
    return { text: fallback, ai: false };
  }
}
