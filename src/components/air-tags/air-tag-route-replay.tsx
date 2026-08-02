"use client";

/**
 * AirTag manual-sighting map replay — adapted from
 * src/components/gps903/route-replay.tsx, but the underlying data is
 * fundamentally different: GPS903 points come from continuous device polling
 * (a real path was driven between fixes), while AirTag points are discrete
 * human-entered sightings (manual form entry or CSV import) with gaps of any
 * length between them. There is no real path between two sightings — we
 * simply don't know how the tag moved in between.
 *
 * Consequently, unlike route-replay.tsx:
 *  - The connecting line is rendered dashed + low-opacity (never a solid
 *    "traveled" polyline) so it reads as "these points were seen, in this
 *    order" rather than "this route was driven".
 *  - A persistent "Manual sightings — not a continuous GPS track" banner is
 *    always mounted in the header, regardless of loading/error/empty/data
 *    state or play/scrub position — this is a hard product requirement, not
 *    cosmetic (misrepresenting sparse manual pings as a continuous track
 *    would be misleading in an investigative product).
 *  - There is no speed/heading gauge — /api/air-tags/history's contract has
 *    no `speed`/`heading` fields (see that route's doc comment).
 *  - The date picker has no 30-day floor — AirTag data is never pruned, so
 *    it can go back to whenever the tracker was created (airTagMinDate()).
 *  - Every sighting gets its own marker + popup (timestamp/accuracy/note),
 *    not just start/current, since each one is an individual piece of
 *    evidence, not a sample of a continuous trace.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Circle,
  InfoWindow,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  X,
  Play,
  Pause,
  Flag,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Ruler,
  StickyNote,
} from "lucide-react";
import { MAP_ID, formatBangkokTime } from "@/lib/maps/shared";
import {
  airTagBangkokToday,
  airTagMinDate,
  shiftAirTagDay,
} from "./air-tag-replay-utils";

export interface AirTagPoint {
  lat: number;
  lng: number;
  /** ISO 8601 UTC. */
  t: string;
  accuracyM: number | null;
  note: string | null;
}

export interface AirTagTrackerForReplay {
  id: string;
  label: string;
  /** Used to floor the date picker — AirTag history isn't pruned, so there's
   *  no other natural lower bound. */
  created_at?: string | null;
}

const SPEEDS = [1, 2, 4, 8] as const;

// Fit the map to the full set of sightings once, after they load.
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

export function AirTagRouteReplay({
  tracker,
  onClose,
}: {
  tracker: AirTagTrackerForReplay;
  onClose: () => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const [pts, setPts] = useState<AirTagPoint[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [error, setError] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = airTagBangkokToday();
  const minDate = airTagMinDate(tracker.created_at);
  const [date, setDate] = useState<string>(() => (minDate <= today ? today : minDate));
  const isToday = date >= today;

  // Load the day's sightings from the AirTag history endpoint (oldest-first).
  useEffect(() => {
    let cancelled = false;
    setPts(null);
    setError(false);
    setPlaying(false);
    setSelectedIdx(null);
    (async () => {
      try {
        const res = await fetch(`/api/air-tags/history?airTagId=${tracker.id}&date=${date}`);
        if (!res.ok) throw new Error(String(res.status));
        const { points } = (await res.json()) as { points: AirTagPoint[] };
        if (cancelled) return;
        setPts(points ?? []);
        setIdx(0);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tracker.id, date, reloadKey]);

  // Scrub ticker — moves the "current sighting" pointer, it does not reveal a
  // solid traveled line (there's no continuous track to reveal).
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
    }, Math.max(300, 900 / speed));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, pts]);

  const path = useMemo(() => (pts ?? []).map((p) => ({ lat: p.lat, lng: p.lng })), [pts]);
  const cur = pts && pts.length ? pts[Math.min(idx, pts.length - 1)] : null;
  const hasPoints = !!pts && pts.length > 0;
  const hasMultiple = !!pts && pts.length >= 2;

  function togglePlay() {
    if (!hasMultiple) return;
    setPlaying((p) => {
      if (!p && idx >= pts!.length - 1) setIdx(0);
      return !p;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{tracker.label}</p>
          <p className="font-mono text-[11px] text-muted-foreground">AirTag sighting replay</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Persistent disclosure banner — must stay visible in every state
          (loading/error/empty/data, and throughout playback), so it is
          mounted here unconditionally rather than inside the map's
          conditional content area. */}
      <div
        role="note"
        aria-label="Manual sightings disclosure"
        className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-600 dark:text-amber-400"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Manual sightings — not a continuous GPS track. Gaps between points are unknown movement.</span>
      </div>

      {/* Date navigator — unbounded back to the tracker's creation date;
          AirTag history is never pruned, unlike GPS903's 30-day cap. */}
      <div className="flex items-center justify-center gap-2 border-b border-border/60 bg-card/60 px-4 py-2">
        <button
          onClick={() => setDate((d) => shiftAirTagDay(d, -1))}
          disabled={date <= minDate}
          aria-label="Previous day"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={date}
          min={minDate}
          max={today}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          className="rounded-md border border-border/60 bg-background px-2 py-1 text-sm text-foreground [color-scheme:dark]"
        />
        <button
          onClick={() => setDate((d) => (d >= today ? d : shiftAirTagDay(d, 1)))}
          disabled={isToday}
          aria-label="Next day"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading state */}
        {!pts && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sightings…
          </div>
        )}
        {/* Error state — with retry */}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-7 w-7 text-destructive/40" />
            <span>Failed to load sighting history.</span>
            <button
              onClick={() => {
                setError(false);
                setReloadKey((k) => k + 1);
              }}
              className="rounded-md border border-border/60 px-3 py-1 text-xs hover:bg-muted"
            >
              Retry
            </button>
          </div>
        )}
        {/* Empty state */}
        {pts && pts.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-6 text-center text-sm text-muted-foreground">
            <MapPin className="h-7 w-7 text-muted-foreground/30" />
            <span className="font-medium">No sightings recorded for this date</span>
            <span className="text-xs text-muted-foreground/70">
              Try another day with the date picker above, or add a manual ping / import a CSV.
            </span>
          </div>
        )}
        {apiKey && (
          <APIProvider apiKey={apiKey}>
            <Map
              mapId={MAP_ID}
              defaultZoom={13}
              defaultCenter={path[0] ?? { lat: 13.75, lng: 100.5 }}
              gestureHandling="greedy"
              disableDefaultUI={false}
              fullscreenControl={false}
              className="h-full w-full"
            >
              <FitOnce points={path} />

              {/* Dashed, low-opacity connector — deliberately NOT a solid
                  "traveled" line. It only indicates chronological order
                  between sightings, never an implied real path. */}
              {path.length >= 2 && (
                <Polyline
                  path={path}
                  strokeOpacity={0}
                  strokeWeight={0}
                  icons={[
                    {
                      icon: { path: "M 0,-1 0,1", strokeOpacity: 0.6, scale: 3 },
                      offset: "0",
                      repeat: "14px",
                    },
                  ]}
                />
              )}

              {/* One marker per sighting — each is independent evidence. */}
              {pts?.map((p, i) => {
                const isCurrent = i === idx;
                return (
                  <AdvancedMarker
                    key={`${p.t}-${i}`}
                    position={{ lat: p.lat, lng: p.lng }}
                    zIndex={isCurrent ? 500 : 100 + i}
                    title={formatBangkokTime(p.t)}
                    onClick={() => {
                      setPlaying(false);
                      setIdx(i);
                      setSelectedIdx(i);
                    }}
                  >
                    {isCurrent ? (
                      <div className="relative flex items-center justify-center">
                        <span className="absolute h-9 w-9 animate-ping rounded-full bg-amber-400/30" />
                        <span className="relative h-5 w-5 rounded-full border-2 border-white bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.9)]" />
                      </div>
                    ) : i === 0 ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow">
                        <Flag className="h-2.5 w-2.5 text-white" />
                      </span>
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500/80 shadow" />
                    )}
                  </AdvancedMarker>
                );
              })}

              {/* Optional translucent accuracy-radius circle for the current
                  sighting (only when accuracyM is present). */}
              {cur?.accuracyM != null && (
                <Circle
                  center={{ lat: cur.lat, lng: cur.lng }}
                  radius={cur.accuracyM}
                  strokeColor="#f59e0b"
                  strokeOpacity={0.5}
                  strokeWeight={1}
                  fillColor="#f59e0b"
                  fillOpacity={0.12}
                />
              )}

              {selectedIdx != null && pts?.[selectedIdx] && (
                <InfoWindow
                  position={{ lat: pts[selectedIdx].lat, lng: pts[selectedIdx].lng }}
                  onCloseClick={() => setSelectedIdx(null)}
                  pixelOffset={[0, -30]}
                >
                  <div className="min-w-[180px] space-y-1 p-1 text-sm">
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatBangkokTime(pts[selectedIdx].t)}
                    </p>
                    <p className="flex items-center gap-1 text-xs">
                      <Ruler className="h-3 w-3 text-muted-foreground" />
                      Accuracy:{" "}
                      {pts[selectedIdx].accuracyM != null ? `±${pts[selectedIdx].accuracyM} m` : "unknown"}
                    </p>
                    {pts[selectedIdx].note && (
                      <p className="flex items-start gap-1 text-xs">
                        <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="break-words">{pts[selectedIdx].note}</span>
                      </p>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border/60 bg-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-mono text-muted-foreground">{cur ? formatBangkokTime(cur.t) : "—"}</span>
          <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400">
            <Ruler className="h-3.5 w-3.5" />
            {cur?.accuracyM != null ? `±${cur.accuracyM} m` : "accuracy unknown"}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, (pts?.length ?? 1) - 1)}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            setIdx(Number(e.target.value));
          }}
          disabled={!hasPoints}
          className="w-full accent-amber-500"
        />

        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={togglePlay}
            disabled={!hasMultiple}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </button>

          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  speed === s
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <span className="font-mono text-xs text-muted-foreground">
            {hasPoints ? `${idx + 1}/${pts!.length}` : "0/0"}
          </span>
        </div>
      </div>
    </div>
  );
}
