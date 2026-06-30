"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import { X, Play, Pause, Gauge, Flag, MapPin, Loader2 } from "lucide-react";
import { MAP_ID, formatBangkokTime } from "@/lib/maps/shared";
import type { GpsDeviceForMap } from "@/lib/types";

interface Pt {
  lat: number;
  lng: number;
  speed: number;
  t: string;
}

const SPEEDS = [1, 2, 4, 8] as const;

// Fit the map to the full track once, after it loads.
function FitOnce({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!map || done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(16);
      return;
    }
    const b = new google.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    map.fitBounds(b, 80);
  }, [map, points]);
  return null;
}

export function RouteReplay({ device, onClose }: { device: GpsDeviceForMap; onClose: () => void }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const name = device.cred_name ?? device.notes ?? `GPS903-${device.gps903_device_id ?? "?"}`;

  const [pts, setPts] = useState<Pt[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load the track LIVE from the GPS903 server (last 24h), oldest-first for
  // replay — the authoritative history, not our stored fixes.
  useEffect(() => {
    let cancelled = false;
    setPts(null);
    setError(false);
    (async () => {
      try {
        const res = await fetch(`/api/gps/history?deviceId=${device.id}&hours=24`);
        if (!res.ok) throw new Error(String(res.status));
        const { points } = (await res.json()) as { points: Pt[] };
        if (cancelled) return;
        setPts(points ?? []);
        setIdx(0);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [device.id]);

  // Playback ticker.
  useEffect(() => {
    if (!playing || !pts || pts.length < 2) return;
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= pts.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, Math.max(70, 600 / speed));
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, speed, pts]);

  const path     = useMemo(() => (pts ?? []).map((p) => ({ lat: p.lat, lng: p.lng })), [pts]);
  const traveled = useMemo(() => path.slice(0, idx + 1), [path, idx]);
  const cur      = pts && pts.length ? pts[Math.min(idx, pts.length - 1)] : null;
  const hasTrack = !!pts && pts.length >= 2;

  function togglePlay() {
    if (!hasTrack) return;
    setPlaying((p) => {
      // Restart from the beginning if we're at the end.
      if (!p && idx >= (pts!.length - 1)) setIdx(0);
      return !p;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">ย้อนเส้นทาง · Route replay</p>
        </div>
        <button
          onClick={onClose}
          aria-label="ปิด"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1 overflow-hidden">
        {!pts && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังดึงเส้นทางจาก GPS903…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-7 w-7 text-destructive/40" />
            <span>ดึงประวัติเส้นทางจาก GPS903 ไม่สำเร็จ</span>
            <button
              onClick={() => { setError(false); setPts(null); setIdx(0); fetch(`/api/gps/history?deviceId=${device.id}&hours=24`).then(async (r) => { if (!r.ok) throw new Error(); const { points } = await r.json(); setPts(points ?? []); }).catch(() => setError(true)); }}
              className="rounded-md border border-border/60 px-3 py-1 text-xs hover:bg-muted"
            >
              ลองใหม่
            </button>
          </div>
        )}
        {pts && pts.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-7 w-7 text-muted-foreground/30" />
            ไม่มีประวัติเส้นทางของอุปกรณ์นี้
          </div>
        )}
        {apiKey && (
          <APIProvider apiKey={apiKey}>
            <Map mapId={MAP_ID} defaultZoom={13} defaultCenter={path[0] ?? { lat: 13.75, lng: 100.5 }} gestureHandling="greedy" disableDefaultUI={false} fullscreenControl={false} className="h-full w-full">
              <FitOnce points={path} />
              {path.length >= 2 && <Polyline path={path} strokeColor="#38bdf8" strokeOpacity={0.25} strokeWeight={4} />}
              {traveled.length >= 2 && <Polyline path={traveled} strokeColor="#0ea5e9" strokeOpacity={0.95} strokeWeight={5} />}
              {path.length > 0 && (
                <AdvancedMarker position={path[0]} title="จุดเริ่มต้น">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow"><Flag className="h-2.5 w-2.5 text-white" /></span>
                </AdvancedMarker>
              )}
              {cur && (
                <AdvancedMarker position={{ lat: cur.lat, lng: cur.lng }} zIndex={500} title="ตำแหน่งขณะเล่น">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute h-9 w-9 animate-ping rounded-full bg-sky-400/30" />
                    <span className="relative h-5 w-5 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.9)]" />
                  </div>
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border/60 bg-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-mono text-muted-foreground">{cur ? formatBangkokTime(cur.t) : "—"}</span>
          <span className="flex items-center gap-1 font-mono text-sky-500">
            <Gauge className="h-3.5 w-3.5" />{cur ? `${Math.round(cur.speed)} km/h` : "—"}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, (pts?.length ?? 1) - 1)}
          value={idx}
          onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
          disabled={!hasTrack}
          className="w-full accent-sky-500"
        />

        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={togglePlay}
            disabled={!hasTrack}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "หยุด" : "เล่น"}
          </button>

          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  speed === s ? "bg-primary text-primary-foreground" : "border border-border/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <span className="font-mono text-xs text-muted-foreground">
            {hasTrack ? `${idx + 1}/${pts!.length}` : "0/0"}
          </span>
        </div>
      </div>
    </div>
  );
}
