"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

/**
 * A small single-marker map for an image's EXIF GPS coordinates. Falls back to a
 * plain coordinate + Google Maps link when no browser Maps API key is configured,
 * so the panel is always useful.
 */
export function OsintGpsMap({ lat, lng }: { lat: number; lng: number }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? undefined;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  if (!apiKey) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-sky-400 underline"
      >
        {lat.toFixed(6)}, {lng.toFixed(6)} — open in Google Maps
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-56 w-full overflow-hidden rounded-lg border border-border">
        <APIProvider apiKey={apiKey}>
          <Map
            mapId={mapId}
            defaultCenter={{ lat, lng }}
            defaultZoom={14}
            gestureHandling="cooperative"
            disableDefaultUI={false}
          >
            <AdvancedMarker position={{ lat, lng }} />
          </Map>
        </APIProvider>
      </div>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline">
        {lat.toFixed(6)}, {lng.toFixed(6)} — open in Google Maps
      </a>
    </div>
  );
}
