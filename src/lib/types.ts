// ============================================================================
// Shared domain types.
//
// DB-row-shaped types are now ALIASED from the generated Supabase types in
// `./database.types.ts` (run `supabase gen types typescript --linked --schema
// public > src/lib/database.types.ts` to regenerate). Do NOT hand-edit the
// generated file. The aliases below keep the exported names stable so importers
// do not change; where a row needs server-decoration fields, narrowed unions, or
// typed jsonb, the generated `Row<T>` is layered with `Omit`/`&` here.
//
// App-only types (AI intake contracts, composed/joined/enriched shapes, jsonb
// element shapes) remain hand-authored below — they do not mirror a single table.
// ============================================================================

import type { Database } from "@/lib/database.types";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

// ─── Enum unions (re-sourced from generated PG enums where one exists) ───────
// These track real PG enums, so they regenerate automatically with the schema.
export type UserRole = Enums<"user_role">;
export type CaseStatus = Enums<"case_status">;
export type CasePriority = Enums<"case_priority">;
export type EvidenceType = Enums<"evidence_type">;
// NOTE: expense_category is DB-faithful and (re)includes the legacy values
// `food`/`hotel` (no live rows carry them; DB enum cleanup is tracked as TD-10).
export type ExpenseCategory = Enums<"expense_category">;
export type ExpenseStatus = Enums<"expense_status">;
export type PayrollStatus = Enums<"payroll_status">;
export type AlertStatus = Enums<"alert_status">;
export type GpsProvider = Enums<"gps_provider">;
export type InvoiceStatus = Enums<"invoice_status">;
export type NotificationType = Enums<"notification_type">;

// ─── App-only unions (text/CHECK-less columns; NO PG enum to source from) ────
// The generator emits these columns as `string`; these hand unions preserve the
// app-side narrowing and are re-applied over the generated rows below.
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

export type LocationType = "home" | "workplace" | "school" | "gym" | "other";

export type RelationKind =
  | "spouse"
  | "partner"
  | "friend"
  | "associate"
  | "family"
  | "other";

// ─── jsonb element shape (column is `Json` in the generated row) ─────────────
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// ─── Clean 1:1 DB-row aliases ────────────────────────────────────────────────
// `email` is nullable in the column but narrowed to `string` here to match the
// long-standing app contract (consumers pass it to non-null props).
export type Profile = Omit<Row<"profiles">, "email"> & { email: string };
export type Client = Row<"clients">;
export type GpsDevicePosition = Row<"gps_device_positions">;
export type GpsDeviceAccess = Row<"gps_device_access">;
export type Gps903Device = Row<"gps903_devices">;
export type Evidence = Row<"evidence">;
export type AgentPayment = Row<"agent_payments">;
export type EmergencyAlert = Row<"emergency_alerts">;
export type Notification = Row<"notifications">;
export type CaseMessage = Row<"case_messages">;

// `audit_logs.ip_address` is `inet` (generated as `unknown`) and `metadata` is
// `jsonb`; expose them with the app-friendly shapes the consumers expect.
export type AuditLog = Omit<Row<"audit_logs">, "ip_address" | "metadata"> & {
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
};

// `geofences.coordinates` is `Json`; consumers rely on the lat/lng array shape.
export type Geofence = Omit<Row<"geofences">, "coordinates"> & {
  coordinates: Array<{ lat: number; lng: number }>;
};

// ─── Rows with narrowed unions (column is `string` in the generated row) ─────
export type Agent = Omit<Row<"agents">, "status" | "agent_role" | "vehicle_type"> & {
  status: AgentStatus;
  agent_role: AgentRole | null;
  vehicle_type: AgentVehicleType | null;
};

// `last_locate_mode` is `string | null` in the generated row; keep the union.
export type GpsDevice = Omit<Row<"gps_devices">, "last_locate_mode"> & {
  last_locate_mode: "gps" | "lbs" | "offline" | "unknown" | null;
};

// `event_type` is `string` in the generated row; keep the enter/exit union.
export type GeofenceEvent = Omit<Row<"geofence_events">, "event_type"> & {
  event_type: "enter" | "exit";
};

// `cases.status`/`priority` are already real PG enums in the generated row.
export type Case = Row<"cases">;

// `expenses.category`/`status` are real PG enums; `ocr_raw` (Json) is additive
// and allowed through. `source` is plain text in DB → stays `string`.
export type Expense = Row<"expenses">;

// `invoices.line_items` is `Json`; type it as the InvoiceLineItem array.
export type Invoice = Omit<Row<"invoices">, "line_items"> & {
  line_items: InvoiceLineItem[];
};

export type AgentLocationHistory = Row<"agent_location_history">;

// ─── Credential safety ───────────────────────────────────────────────────────
// `gps903_credentials.device_password` MUST NOT reach the browser. It exists on
// the generated row, so it is explicitly Omitted here. Never select it client-side.
export type Gps903Credential = Omit<Row<"gps903_credentials">, "device_password">;

// ─── Rows + re-applied server decorations (NOT DB columns) ───────────────────
// `signedUrl` is attached server-side after generating a signed storage URL.
// `timeline_entry_id` is omitted to preserve the historical LinkedEvidence shape
// (it is selected separately for linking, not part of the decorated payload).
export type LinkedEvidence = Omit<Row<"evidence">, "timeline_entry_id"> & {
  signedUrl: string;
};

export type TimelineEntry = Row<"timeline_entries"> & {
  linked_evidence?: LinkedEvidence[];
};

export type TargetPhoto = Row<"target_photos"> & { signedUrl?: string };

export type VehiclePhoto = Row<"vehicle_photos"> & { signedUrl?: string };

// `licensePlate`/`photoSignedUrl` are server-decorated (decrypted plate +
// signed URL); they are not DB columns.
export type TargetVehicle = Row<"target_vehicles"> & {
  licensePlate?: string | null;
  photoSignedUrl?: string | null;
};

// `location_type` is plain text in DB (generated `string`); keep the app union.
// `address`/`photoSignedUrl` are server-decorated (decrypted address + signed URL).
export type TargetLocation = Omit<Row<"target_locations">, "location_type"> & {
  location_type: LocationType;
  address?: string | null;
  photoSignedUrl?: string | null;
};

// `relation` is plain text in DB (generated `string`); keep the app union.
// `name` is the server-side decrypted plaintext of `name_enc` (not a DB column).
export type TargetRelationship = Omit<Row<"target_relationships">, "relation"> & {
  relation: RelationKind;
  name?: string | null;
};

// ─── Composed / enriched / joined shapes (NOT single-table mirrors) ──────────
export interface GpsDeviceAccessWithProfile extends GpsDeviceAccess {
  profiles: Pick<Profile, "id" | "full_name" | "email" | "role" | "avatar_url"> | null;
}

/** GpsDevice extended with case_number and credential metadata for map display. */
export interface GpsDeviceForMap extends GpsDevice {
  case_number: string | null;
  cred_name: string | null; // from gps903_credentials.device_name
  cred_imei: string | null;
  cred_phone: string | null;
  cred_provider: string | null;
}

export interface CaseWithAgents extends Case {
  agents?: Agent[];
}

export interface EnrichedUser extends Profile {
  last_sign_in_at: string | null;
  otp_verified: boolean;
  agent_code: string | null;
  agent_status: AgentStatus | null;
  battery_pct: number | null;
}

export interface CaseMessageWithSender extends CaseMessage {
  profiles: Pick<Profile, "id" | "full_name" | "role"> | null;
}

// ─── AI / extraction contracts (app-only; NOT row mirrors) ───────────────────
export interface ExtractedExpense {
  vendor_name: string | null;
  category: ExpenseCategory;
  amount: number | null;
  vat_amount: number | null;
  expense_date: string | null;
  expense_time: string | null;
  receipt_number: string | null;
  notes: string | null;
  confidence: number;
  field_confidence: {
    vendor_name: number;
    category: number;
    amount: number;
    vat_amount: number;
    expense_date: number;
    expense_time: number;
    receipt_number: number;
  };
}

// ─── AI Case Intake ────────────────────────────────────────────────────────
// The extraction contract returned by Claude (forced tool use) and edited on
// the review screen before any database write. Every item carries a confidence
// (0-100) and the source filenames it was derived from.

export type IntakeImageKind =
  | "target_photo"
  | "vehicle_photo"
  | "document"
  | "screenshot"
  | "location"
  | "other";

export type IntakeDocKind =
  | "id_card"
  | "passport"
  | "drivers_license"
  | "vehicle_reg"
  | "contract"
  | "other";

export interface IntakeSocial {
  platform: string | null;
  handle: string | null;
}

export interface IntakeTarget {
  full_name: string | null;
  nickname: string | null;
  gender: string | null;
  dob: string | null;
  age: number | null;
  nationality: string | null;
  occupation: string | null;
  phones: string[];
  emails: string[];
  socials: IntakeSocial[];
  notes: string | null;
  confidence: number;
  source_files: string[];
}

export interface IntakeVehicle {
  make: string | null;
  model: string | null;
  color: string | null;
  plate: string | null;
  is_primary: boolean;
  confidence: number;
  source_files: string[];
}

export interface IntakeLocation {
  type: "home" | "workplace" | "other";
  label: string | null;
  address: string | null;
  notes: string | null;
  confidence: number;
  source_files: string[];
}

export interface IntakeRelationship {
  name: string | null;
  relation: RelationKind;
  notes: string | null;
  confidence: number;
  source_files: string[];
}

export interface IntakeTimelineEvent {
  date: string | null;
  time: string | null;
  entry: string;
  location: string | null;
  confidence: number;
  source_files: string[];
}

export interface IntakeDocument {
  source_file: string;
  doc_kind: IntakeDocKind;
  summary: string | null;
  confidence: number;
}

export interface IntakeImageClassification {
  file: string;
  kind: IntakeImageKind;
  confidence: number;
  vehicle_index?: number | null;
}

export interface IntakeExtraction {
  case: {
    suggested_title: string | null;
    summary: string | null;
    case_type: string | null;
  };
  targets: IntakeTarget[];
  vehicles: IntakeVehicle[];
  locations: IntakeLocation[];
  relationships: IntakeRelationship[];
  timeline: IntakeTimelineEvent[];
  documents: IntakeDocument[];
  image_classifications: IntakeImageClassification[];
}

/** A file staged in the evidence bucket under `_intake/{intakeId}/` during analysis. */
export interface IntakeStagedFile {
  /** original filename as uploaded (the key Claude references in source_files) */
  name: string;
  /** storage path within the evidence bucket */
  path: string;
  mime_type: string;
  size: number;
}

export interface IntakeAnalyzeResult {
  intakeId: string;
  files: IntakeStagedFile[];
  extraction: IntakeExtraction;
}
