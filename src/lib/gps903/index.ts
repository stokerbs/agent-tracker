/**
 * Shared GPS903 Web API client (public surface).
 * Used by: /api/cron/gps903-sync and the /gps-devices · /gps903-* server actions.
 *
 * Split into focused modules — login, tracking, history, discovery, session
 * cache, and position writes — over a shared `client` of constants + helpers.
 * This barrel preserves the original `@/lib/gps903` import surface.
 *
 * Session management: per-credential (one ASP.NET session per device IMEI),
 * cached in gps903_credential_sessions keyed by gps903_credentials.id.
 */

export { GPS903_BASE, GPS903_TIMEZONE } from "./client";
export { gps903Login } from "./login";
export { type TrackingResult, gps903GetTracking } from "./tracking";
export { type HistoryPoint, gps903GetHistory } from "./history";
export {
  type Gps903DiagEntry,
  type Gps903DiscoveryResult,
  runGps903Discovery,
  detectGps903DeviceId,
} from "./discovery";
export {
  type Gps903CredentialForSession,
  getOrRefreshCredentialSession,
} from "./session";
export { applyPositionToDevice } from "./position";
