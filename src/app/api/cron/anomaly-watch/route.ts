import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyRole, notificationLinks } from "@/lib/notifications";
import { buildAnomalyAlert, detectAnomalies, type Fix } from "@/lib/ops/anomaly";

export const maxDuration = 60;

/**
 * GET /api/cron/anomaly-watch
 * Vercel Cron (every 6h) — AI Anomaly Watch.
 *
 * For each active tracked device, compares the last 24h of GPS behaviour to its
 * preceding 2-week baseline and flags surveillance-relevant anomalies (new
 * location, unusual night movement, going dark). When a *new* anomaly is found
 * (signature changed since last alert), Claude phrases it and staff (admin /
 * supervisor) are notified + pushed. A per-device signature dedupes re-alerts.
 *
 * Auth: fail-closed CRON_SECRET bearer, same as the other crons.
 */
const BASELINE_DAYS = 14;
const RECENT_HOURS = 24;
const MAX_FIXES = 6000; // safety cap per device

interface DeviceRow {
  id: string;
  notes: string | null;
  gps903_device_id: number | null;
  case_id: string;
  last_seen_at: string | null;
  anomaly_signature: string | null;
}

interface PosRow {
  lat: number;
  lng: number;
  speed_kmh: number;
  recorded_at: string;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = new Date();
  const baselineStart = new Date(now.getTime() - BASELINE_DAYS * 24 * 3_600_000).toISOString();
  const recentCutoff = now.getTime() - RECENT_HOURS * 3_600_000;

  const { data: devices } = await svc
    .from("gps_devices")
    .select("id, notes, gps903_device_id, case_id, last_seen_at, anomaly_signature")
    .is("deleted_at", null)
    .not("last_lat", "is", null);

  let scanned = 0;
  let alerted = 0;

  for (const d of (devices ?? []) as DeviceRow[]) {
    scanned++;
    const label = d.notes ?? `GPS903-${d.gps903_device_id ?? "?"}`;

    const { data: pos } = await svc
      .from("gps_device_positions")
      .select("lat, lng, speed_kmh, recorded_at")
      .eq("gps_device_id", d.id)
      .gte("recorded_at", baselineStart)
      .order("recorded_at", { ascending: true })
      .limit(MAX_FIXES);

    const fixes: Fix[] = ((pos ?? []) as PosRow[]).map((p) => ({
      lat: p.lat,
      lng: p.lng,
      speed: p.speed_kmh ?? 0,
      t: p.recorded_at,
    }));
    const baseline = fixes.filter((f) => Date.parse(f.t) < recentCutoff);
    const recent = fixes.filter((f) => Date.parse(f.t) >= recentCutoff);

    const { signals, signature } = detectAnomalies({
      baseline,
      recent,
      lastSeenAt: d.last_seen_at,
      now,
    });

    // Nothing fired (or cleared) — sync the stored signature, never notify.
    if (signature !== (d.anomaly_signature ?? "")) {
      if (signals.length > 0) {
        const { text } = await buildAnomalyAlert(label, signals);
        const critical = signals.some((s) => s.kind === "went-dark" || s.kind === "new-location");
        await notifyRole(["admin", "supervisor"], {
          type: "system",
          title: `⚠️ ความผิดปกติ — ${label}`,
          body: text,
          url: notificationLinks.gpsMonitor(),
          entityId: d.case_id,
          priority: critical ? "high" : "normal",
        });
        alerted++;
      }
      await svc
        .from("gps_devices")
        .update({ anomaly_signature: signature, anomaly_notified_at: signals.length ? now.toISOString() : null })
        .eq("id", d.id);
    }
  }

  const result = { ok: true, scanned, alerted };
  console.log("[cron] anomaly-watch", result);
  return NextResponse.json(result);
}
