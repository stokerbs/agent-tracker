// Builds the "target intelligence" text block injected into the AI Case Chat
// system prompt. Pure (takes already-decrypted values) so it is unit-testable
// and so decryption stays in the route. Located places get a prebuilt Google
// Maps link per the app-wide rule (the model must not invent URLs).

export interface IntelLocation {
  name: string;
  type: string | null;
  address: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
}
export interface IntelVehicle {
  label: string; // e.g. "Toyota Vios สีขาว"
  plate: string | null;
  notes: string | null;
}
export interface IntelRelationship {
  name: string | null;
  relation: string | null;
  notes: string | null;
}
export interface TargetIntel {
  name: string | null;
  alias: string | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  notes: string | null;
  locations: IntelLocation[];
  vehicles: IntelVehicle[];
  relationships: IntelRelationship[];
}

const mapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

/** Pick an Anthropic-friendly media type from a storage path + optional mime. */
export function mediaTypeFor(path: string, fallback: string | null): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return fallback && fallback.startsWith("image/") ? fallback : "image/jpeg";
}

/** Render the target-intelligence section, or "" if there is nothing to show. */
export function buildIntelText(intel: TargetIntel): string {
  const lines: string[] = [];

  const id: string[] = [];
  if (intel.name) id.push(`ชื่อ: ${intel.name}`);
  if (intel.alias) id.push(`นามแฝง: ${intel.alias}`);
  if (intel.phone) id.push(`โทร: ${intel.phone}`);
  if (intel.email) id.push(`อีเมล: ${intel.email}`);
  if (intel.dob) id.push(`เกิด: ${intel.dob}`);
  if (id.length) lines.push(`เป้าหมาย — ${id.join(" · ")}`);
  if (intel.notes) lines.push(`โน้ตเป้าหมาย: ${intel.notes}`);

  if (intel.locations.length) {
    lines.push("สถานที่เกี่ยวข้อง:");
    for (const l of intel.locations) {
      const bits = [l.name];
      if (l.type) bits.push(`(${l.type})`);
      if (l.address) bits.push(l.address);
      if (l.notes) bits.push(`— ${l.notes}`);
      if (l.lat != null && l.lng != null) bits.push(mapsLink(l.lat, l.lng));
      lines.push(`• ${bits.join(" ")}`);
    }
  }

  if (intel.vehicles.length) {
    lines.push("ยานพาหนะ:");
    for (const v of intel.vehicles) {
      const bits = [v.label];
      if (v.plate) bits.push(`ทะเบียน ${v.plate}`);
      if (v.notes) bits.push(`— ${v.notes}`);
      lines.push(`• ${bits.join(" ")}`);
    }
  }

  if (intel.relationships.length) {
    lines.push("บุคคลที่เกี่ยวข้อง:");
    for (const r of intel.relationships) {
      const bits = [r.name ?? "ไม่ทราบชื่อ"];
      if (r.relation) bits.push(`(${r.relation})`);
      if (r.notes) bits.push(`— ${r.notes}`);
      lines.push(`• ${bits.join(" ")}`);
    }
  }

  return lines.length ? `ข่าวกรองเป้าหมาย:\n${lines.join("\n")}` : "";
}
