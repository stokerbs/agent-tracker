// ============================================================================
// Shared domain types. These mirror the SQL schema in supabase/migrations.
// For a fully generated set you can run:
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// ============================================================================

export type UserRole = "admin" | "supervisor" | "agent" | "client";

export type AgentStatus =
  | "online"
  | "moving"
  | "idle"
  | "offline"
  | "emergency";

export type AgentRole =
  | "field_agent"
  | "supervisor"
  | "team_leader"
  | "operations";

export type AgentVehicleType = "car" | "motorcycle" | "foot";

export type CaseStatus = "new" | "assigned" | "active" | "pending" | "closed" | "cancelled";
export type CasePriority = "low" | "medium" | "high" | "critical";
export type EvidenceType = "photo" | "video" | "pdf" | "document" | "audio";
export type ExpenseCategory =
  | "fuel"
  | "toll"
  | "parking"
  | "food"
  | "hotel"
  | "misc";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type GpsProvider = "AIS" | "TRUE" | "DTAC" | "GPS903";
// "submitted" kept for backward compatibility with rows created before migration 0021.
export type ReportStatus = "draft" | "review" | "submitted" | "approved" | "rejected";
export type ReportLanguage = "th" | "en";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}
export type NotificationType =
  | "emergency"
  | "case"
  | "report"
  | "assignment"
  | "system";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  profile_id: string | null;
  agent_code: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  position: string | null;
  area: string | null;
  status: AgentStatus;
  agent_role: AgentRole | null;
  last_active: string | null;
  current_lat: number | null;
  current_lng: number | null;
  battery_pct: number | null;
  is_charging: boolean | null;
  speed_kmh: number | null;
  heading: number | null;
  vehicle_type: AgentVehicleType | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  profile_id: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  client_id: string | null;
  client_name: string | null;
  case_type: string | null;
  // encrypted PII — plaintext columns dropped in migration 0008
  target_name_enc: string | null;
  target_name_bidx: string | null;
  target_phone_enc: string | null;
  target_phone_bidx: string | null;
  target_vehicle_enc: string | null;
  license_plate_enc: string | null;
  license_plate_bidx: string | null;
  target_address_enc: string | null;
  start_date: string | null;
  end_date: string | null;
  status: CaseStatus;
  priority: CasePriority;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface GpsDevice {
  id: string;
  case_id: string;
  imei: string | null;
  phone_number: string | null;
  provider: GpsProvider | null;
  notes: string | null;
  agent_id: string | null;
  traccar_id: number | null;
  gps903_device_id: number | null;
  last_polled_at: string | null;
  last_poll_ok: boolean | null;
  // Denormalized last-known position (updated by GPS903 polling, not by agents)
  last_lat:          number | null;
  last_lng:          number | null;
  last_speed_kmh:    number | null;
  last_heading:      number | null;
  last_battery_pct:  number | null;
  last_seen_at:      string | null;
  last_locate_mode:  "gps" | "lbs" | "offline" | "unknown" | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GpsDevicePosition {
  id:            string;
  gps_device_id: string;
  lat:           number;
  lng:           number;
  speed_kmh:     number;
  heading:       number;
  battery_pct:   number | null;
  recorded_at:   string;
}

export interface GpsDeviceAccess {
  id:            string;
  gps_device_id: string;
  profile_id:    string;
  granted_by:    string | null;
  created_at:    string;
}

export interface GpsDeviceAccessWithProfile extends GpsDeviceAccess {
  profiles: Pick<Profile, "id" | "full_name" | "email" | "role" | "avatar_url"> | null;
}

/** GpsDevice extended with case_number for map display. */
export interface GpsDeviceForMap extends GpsDevice {
  case_number: string | null;
}

export interface Gps903Device {
  id:               string;
  gps903_device_id: number;
  device_name:      string | null;
  imei:             string | null;
  model:            string | null;
  last_seen:        string | null;
  synced_at:        string;
  created_at:       string;
  updated_at:       string;
}

/** Per-device IMEI credential stored in gps903_credentials table. */
export interface Gps903Credential {
  id:               string;
  device_name:      string;
  imei:             string;
  // device_password intentionally absent — never sent to the browser
  gps903_device_id: number | null;  // null until auto-detected via Test Connection
  is_active:        boolean;
  last_synced_at:   string | null;
  last_sync_ok:     boolean | null;
  created_by:       string | null;
  created_at:       string;
  updated_at:       string;
}

export interface CaseWithAgents extends Case {
  agents?: Agent[];
}

export interface TimelineEntry {
  id: string;
  case_id: string;
  agent_id: string | null;
  entry_date: string;
  entry_time: string;
  entry: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface Evidence {
  id: string;
  case_id: string;
  type: EvidenceType;
  category: string | null;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface Expense {
  id: string;
  agent_id: string | null;
  case_id: string | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EmergencyAlert {
  id: string;
  agent_id: string | null;
  case_id: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  status: AlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  case_id: string;
  title: string;
  executive_summary: string | null;
  body: string | null;
  observations: string | null;
  conclusion: string | null;
  status: ReportStatus;
  pdf_url: string | null;
  generated_by: string | null;
  edited_by: string | null;
  edited_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_notes: string | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ReportVersion {
  id: string;
  report_id: string;
  version_number: number;
  content: {
    executive_summary?: string;
    body?: string;
    observations?: string;
    conclusion?: string;
  };
  edited_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  case_id: string | null;
  title: string;
  line_items: InvoiceLineItem[];
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issued_date: string;
  due_date: string | null;
  notes: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface EnrichedUser extends Profile {
  last_sign_in_at: string | null;
  otp_verified: boolean;
  agent_code: string | null;
  agent_status: AgentStatus | null;
  battery_pct: number | null;
}

export interface AiReportSections {
  executive_summary: string;
  chronological_report: string;
  observations: string;
  conclusion: string;
}

export interface AgentLocationHistory {
  id: string;
  agent_id: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  heading: number | null;
  recorded_at: string;
}

export interface Geofence {
  id: string;
  name: string;
  description: string | null;
  coordinates: Array<{ lat: number; lng: number }>;
  color: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface GeofenceEvent {
  id: string;
  geofence_id: string;
  agent_id: string;
  event_type: "enter" | "exit";
  lat: number;
  lng: number;
  occurred_at: string;
}
