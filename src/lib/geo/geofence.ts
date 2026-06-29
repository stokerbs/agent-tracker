// Shared geofence helpers: point-in-polygon test + alert-message builder
// (used by the agent location route and the GPS903 device sync).

export interface LatLng {
  lat: number;
  lng: number;
}

/** Ray-casting point-in-polygon test (simple polygons). */
export function isInsideGeofence(lat: number, lng: number, polygon: LatLng[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.lng > lng !== b.lng > lng &&
      lat < ((b.lat - a.lat) * (lng - a.lng)) / (b.lng - a.lng) + a.lat
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";

/**
 * Build the geofence alert body. Always returns a clean Thai template; when the
 * Anthropic key is configured, upgrades it to a concise natural-language alert
 * (best-effort — any failure or timeout falls back to the template).
 */
export async function buildGeofenceAlert(opts: {
  deviceLabel: string;
  fenceName: string;
  eventType: "enter" | "exit";
}): Promise<string> {
  const { deviceLabel, fenceName, eventType } = opts;
  const fallback = `${deviceLabel} ${eventType === "enter" ? "เข้าสู่" : "ออกจาก"}พื้นที่ “${fenceName}”`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
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
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content:
              `เขียนข้อความแจ้งเตือนสั้นๆ (ไม่เกิน 1 บรรทัด, ภาษาไทย, กระชับ, น้ำเสียงปฏิบัติการ) ` +
              `ว่าอุปกรณ์ติดตาม "${deviceLabel}" ${eventType === "enter" ? "เข้าสู่" : "ออกจาก"}พื้นที่เฝ้าระวัง "${fenceName}". ` +
              `ตอบเฉพาะข้อความแจ้งเตือน ห้ามมีคำอธิบายอื่น`,
          },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text?.trim();
    return text && text.length > 0 ? text : fallback;
  } catch {
    return fallback;
  }
}
