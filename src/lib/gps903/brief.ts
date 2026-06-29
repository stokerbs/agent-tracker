// AI Surveillance Brief — summarize a device's GPS track, then have Claude turn
// the structured summary into a concise Thai investigator brief.

export interface TrackPoint {
  lat: number;
  lng: number;
  speed: number;
  t: string; // ISO
}

export interface Stop {
  lat: number;
  lng: number;
  startedAt: string;
  endedAt: string;
  minutes: number;
}

export interface TrackSummary {
  fixes: number;
  firstAt: string | null;
  lastAt: string | null;
  distanceKm: number;
  movingMinutes: number;
  stoppedMinutes: number;
  maxSpeedKmh: number;
  stops: Stop[]; // longest first, top few
}

const STOP_SPEED = 3; // km/h — at or below = stationary
const STOP_MIN_MINUTES = 5; // ignore micro-stops shorter than this

function haversineKm(a: TrackPoint, b: TrackPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Reduce a (chronological) track to a compact summary suitable for an LLM. */
export function summarizeTrack(points: TrackPoint[]): TrackSummary {
  const empty: TrackSummary = {
    fixes: 0, firstAt: null, lastAt: null, distanceKm: 0,
    movingMinutes: 0, stoppedMinutes: 0, maxSpeedKmh: 0, stops: [],
  };
  if (points.length === 0) return empty;

  let distanceKm = 0;
  let movingMin = 0;
  let stoppedMin = 0;
  let maxSpeed = 0;
  const stops: Stop[] = [];

  let stopStart: TrackPoint | null = null;
  let stopLatSum = 0, stopLngSum = 0, stopN = 0;

  const flushStop = (end: TrackPoint) => {
    if (!stopStart) return;
    const mins = (Date.parse(end.t) - Date.parse(stopStart.t)) / 60000;
    if (mins >= STOP_MIN_MINUTES) {
      stops.push({
        lat: stopLatSum / stopN,
        lng: stopLngSum / stopN,
        startedAt: stopStart.t,
        endedAt: end.t,
        minutes: Math.round(mins),
      });
    }
    stopStart = null; stopLatSum = 0; stopLngSum = 0; stopN = 0;
  };

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    maxSpeed = Math.max(maxSpeed, p.speed);
    if (i > 0) {
      distanceKm += haversineKm(points[i - 1], p);
      const gapMin = (Date.parse(p.t) - Date.parse(points[i - 1].t)) / 60000;
      if (gapMin > 0 && gapMin < 60) {
        if (p.speed > STOP_SPEED) movingMin += gapMin;
        else stoppedMin += gapMin;
      }
    }
    if (p.speed <= STOP_SPEED) {
      if (!stopStart) stopStart = p;
      stopLatSum += p.lat; stopLngSum += p.lng; stopN++;
    } else {
      flushStop(points[i - 1] ?? p);
    }
  }
  flushStop(points[points.length - 1]);

  stops.sort((a, b) => b.minutes - a.minutes);

  return {
    fixes: points.length,
    firstAt: points[0].t,
    lastAt: points[points.length - 1].t,
    distanceKm: Math.round(distanceKm * 10) / 10,
    movingMinutes: Math.round(movingMin),
    stoppedMinutes: Math.round(stoppedMin),
    maxSpeedKmh: Math.round(maxSpeed),
    stops: stops.slice(0, 6),
  };
}

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";

function templateBrief(deviceLabel: string, s: TrackSummary, hours: number): string {
  if (s.fixes === 0) return `ไม่มีข้อมูลการเคลื่อนที่ของ “${deviceLabel}” ในช่วง ${hours} ชั่วโมงที่ผ่านมา`;
  const lines = [
    `สรุปการเคลื่อนที่ของ “${deviceLabel}” (${hours} ชม.ล่าสุด)`,
    `• ระยะทางรวม ~${s.distanceKm} กม. · เคลื่อนที่ ~${s.movingMinutes} นาที · จอด ~${s.stoppedMinutes} นาที · ความเร็วสูงสุด ${s.maxSpeedKmh} กม./ชม.`,
    `• จำนวนจุดจอดสำคัญ: ${s.stops.length}`,
  ];
  s.stops.slice(0, 3).forEach((st, i) => lines.push(`  ${i + 1}. จอด ~${st.minutes} นาที (${st.lat.toFixed(4)}, ${st.lng.toFixed(4)})`));
  return lines.join("\n");
}

/** Compose the brief via Claude; falls back to a clean template on any failure. */
export async function buildSurveillanceBrief(
  deviceLabel: string,
  summary: TrackSummary,
  hours: number,
): Promise<{ brief: string; ai: boolean }> {
  const fallback = templateBrief(deviceLabel, summary, hours);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || summary.fixes === 0) return { brief: fallback, ai: false };

  // Attach a ready-made Google Maps link to each stop so the model emits exact,
  // correct URLs (it just copies the `maps` field) rather than fabricating them.
  const payload = {
    ...summary,
    stops: summary.stops.map((s) => ({
      ...s,
      maps: `https://www.google.com/maps?q=${s.lat.toFixed(5)},${s.lng.toFixed(5)}`,
    })),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
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
        max_tokens: 1600,
        messages: [
          {
            role: "user",
            content:
              `คุณเป็นนักวิเคราะห์ข่าวกรองของหน่วยสืบสวน เขียน "บทสรุปข่าวกรอง" ภาษาไทยอย่างมืออาชีพ กระชับ ` +
              `จากข้อมูลการเคลื่อนที่ของอุปกรณ์ติดตาม "${deviceLabel}" ในช่วง ${hours} ชั่วโมงล่าสุดต่อไปนี้ (JSON):\n\n` +
              JSON.stringify(payload) +
              `\n\nรูปแบบผลลัพธ์:\n` +
              `1) ย่อหน้าสรุปภาพรวม 2-4 ประโยค (พฤติกรรมการเดินทาง/จุดที่ใช้เวลานาน)\n` +
              `2) หัวข้อ "ข้อสังเกตสำคัญ" ตามด้วย bullet 3-5 ข้อ\n` +
              `กฎสำคัญ: ทุกจุดจอด/พิกัดที่อ้างถึงในรายงาน ต้องแนบลิงก์ Google Maps ของจุดนั้นด้วย ` +
              `(ใช้ค่าในฟิลด์ "maps" ของแต่ละ stop ตามจริง ห้ามแต่ง URL เอง).\n` +
              `ใช้เวลาเป็นโซนไทย (ค่าใน JSON เป็น UTC ให้ +7). ห้ามแต่งข้อมูลที่ไม่มีใน JSON. เขียนให้จบสมบูรณ์ ตอบเฉพาะรายงาน.`,
          },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[gps-brief] Anthropic error:", res.status);
      return { brief: fallback, ai: false };
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text?.trim();
    return text ? { brief: text, ai: true } : { brief: fallback, ai: false };
  } catch (e) {
    console.error("[gps-brief] AI brief failed, using template:", e instanceof Error ? e.message : e);
    return { brief: fallback, ai: false };
  }
}
