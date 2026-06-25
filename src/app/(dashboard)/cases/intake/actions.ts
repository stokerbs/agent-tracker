"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { BUCKETS, INTAKE_STAGING_PREFIX } from "@/lib/constants";
import {
  encryptField,
  createNameBlindIndex,
  createPhoneBlindIndex,
  createLicensePlateBlindIndex,
  normalizeLicensePlate,
  normalizeName,
  normalizePhone,
} from "@/lib/security/encryption";
import type {
  EvidenceType,
  IntakeExtraction,
  IntakeStagedFile,
  IntakeImageClassification,
} from "@/lib/types";
import { bangkokDateKey } from "@/lib/utils";

function enc(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? encryptField(s) : null;
}

function detectEvidenceType(mime: string): EvidenceType {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

function extOf(name: string, fallback = "bin"): string {
  const ext = name.split(".").pop();
  return ext && ext.length <= 5 ? ext : fallback;
}

async function nextCaseNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const { count } = await supabase.from("cases").select("id", { count: "exact", head: true });
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `CASE-${new Date().getFullYear()}-${seq}`;
}

/**
 * Creates a fully-populated case from a reviewed intake extraction.
 * No database writes happen before this is called. Staged files are moved out
 * of `_intake/` into the new case's storage paths and classified into the right
 * module (target gallery / vehicle gallery / evidence).
 */
export async function confirmIntake(input: {
  intakeId: string;
  files: IntakeStagedFile[];
  extraction: IntakeExtraction;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { extraction: x, files } = input;

  // ─── 1. Case row ───────────────────────────────────────────────────────────
  const primary = x.targets[0] ?? null;
  const todayBKK = bangkokDateKey();

  const targetName = primary?.full_name?.trim() || null;
  const targetPhone = primary?.phones?.[0]?.trim() || null;
  const targetEmail = primary?.emails?.[0]?.trim() || null;
  const socials = (primary?.socials ?? []).filter((s) => s.platform || s.handle);

  // Fold anything that has no dedicated column into notes (no data loss).
  const noteParts: string[] = [];
  if (primary?.notes) noteParts.push(primary.notes);
  if (x.case.summary) noteParts.push(x.case.summary);
  if ((primary?.phones?.length ?? 0) > 1) noteParts.push(`Other phones: ${primary!.phones.slice(1).join(", ")}`);
  if ((primary?.emails?.length ?? 0) > 1) noteParts.push(`Other emails: ${primary!.emails.slice(1).join(", ")}`);
  if (x.targets.length > 1) {
    const others = x.targets.slice(1).map((t) => t.full_name).filter(Boolean);
    if (others.length) noteParts.push(`Additional persons: ${others.join(", ")}`);
  }
  const notes = noteParts.length ? noteParts.join("\n\n") : null;

  const caseNumber = await nextCaseNumber(supabase);

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .insert({
      case_number: caseNumber,
      case_type: x.case.case_type?.trim() || null,
      target_name_enc: enc(targetName),
      target_name_bidx: targetName ? createNameBlindIndex(normalizeName(targetName)) : null,
      target_phone_enc: enc(targetPhone),
      target_phone_bidx: targetPhone ? createPhoneBlindIndex(normalizePhone(targetPhone)) : null,
      target_alias_enc: enc(primary?.nickname),
      target_gender: primary?.gender ?? null,
      target_age: primary?.age ?? null,
      target_notes_enc: enc(notes),
      target_dob_enc: enc(primary?.dob),
      target_nationality: primary?.nationality?.trim() || null,
      target_occupation: primary?.occupation?.trim() || null,
      target_email_enc: enc(targetEmail),
      target_socials_enc: socials.length ? encryptField(JSON.stringify(socials)) : null,
      description: x.case.suggested_title?.trim() || null,
      status: "new",
      priority: "medium",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (caseErr || !caseRow) return { error: handleDbError(caseErr, "confirmIntake:case") };
  const caseId = caseRow.id as string;

  // ─── 2. Vehicles (keep creation order to map image vehicle_index) ───────────
  const vehicleIds: string[] = [];
  for (const [i, v] of x.vehicles.entries()) {
    const plate = v.plate?.trim() || null;
    const { data, error } = await supabase
      .from("target_vehicles")
      .insert({
        case_id: caseId,
        make: v.make?.trim() || null,
        model: v.model?.trim() || null,
        color: v.color?.trim() || null,
        license_plate_enc: enc(plate),
        license_plate_bidx: plate ? createLicensePlateBlindIndex(normalizeLicensePlate(plate)) : null,
        is_primary: v.is_primary || i === 0,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error || !data) return { error: handleDbError(error, "confirmIntake:vehicle") };
    vehicleIds.push(data.id as string);
  }

  // ─── 3. Locations ───────────────────────────────────────────────────────────
  if (x.locations.length > 0) {
    const locRows = x.locations.map((l) => ({
      case_id: caseId,
      location_type: l.type,
      location_name: l.label?.trim() || l.address?.trim() || null,
      notes: [l.address, l.notes].filter(Boolean).join(" — ") || null,
      created_by: profile.id,
    }));
    const { error } = await supabase.from("target_locations").insert(locRows);
    if (error) return { error: handleDbError(error, "confirmIntake:locations") };
  }

  // ─── 4. Relationships ────────────────────────────────────────────────────────
  if (x.relationships.length > 0) {
    const relRows = x.relationships.map((r) => ({
      case_id: caseId,
      name_enc: enc(r.name),
      relation: r.relation,
      notes: r.notes?.trim() || null,
      created_by: profile.id,
    }));
    const { error } = await supabase.from("target_relationships").insert(relRows);
    if (error) return { error: handleDbError(error, "confirmIntake:relationships") };
  }

  // ─── 5. Timeline (one row per timestamp) ─────────────────────────────────────
  if (x.timeline.length > 0) {
    const tlRows = x.timeline
      .filter((e) => e.entry?.trim())
      .map((e) => ({
        case_id: caseId,
        entry_date: e.date || todayBKK,
        entry_time: e.time ? `${e.time}:00`.slice(0, 8) : "00:00:00",
        entry: e.entry.trim(),
        location: e.location?.trim() || null,
      }));
    if (tlRows.length > 0) {
      const { error } = await supabase.from("timeline_entries").insert(tlRows);
      if (error) return { error: handleDbError(error, "confirmIntake:timeline") };
    }
  }

  // ─── 6. Files — move from staging into the right module ──────────────────────
  const classByFile = new Map<string, IntakeImageClassification>();
  for (const c of x.image_classifications) classByFile.set(c.file, c);
  const docByFile = new Map(x.documents.map((d) => [d.source_file, d]));

  // Track first photo per gallery so we can flag a primary.
  let targetPhotoSeen = false;
  const vehiclePhotoSeen = new Set<string>();

  for (const f of files) {
    const cls = classByFile.get(f.name);
    const isImage = f.mime_type.startsWith("image/");

    // Download staged bytes once.
    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKETS.evidence)
      .download(f.path);
    if (dlErr || !blob) continue; // skip unreadable staged file
    const buffer = Buffer.from(await blob.arrayBuffer());

    if (isImage && cls?.kind === "target_photo") {
      const dest = `${caseId}/photos/${crypto.randomUUID()}.${extOf(f.name, "jpg")}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKETS.intelligence)
        .upload(dest, buffer, { contentType: f.mime_type, upsert: false });
      if (!upErr) {
        await supabase.from("target_photos").insert({
          case_id: caseId,
          storage_path: dest,
          is_primary: !targetPhotoSeen,
          uploaded_by: profile.id,
        });
        targetPhotoSeen = true;
      }
    } else if (isImage && cls?.kind === "vehicle_photo") {
      // Resolve which vehicle this photo belongs to.
      const idx = cls.vehicle_index;
      const vehicleId =
        idx != null && idx >= 0 && idx < vehicleIds.length ? vehicleIds[idx] : vehicleIds[0];
      if (vehicleId) {
        const dest = `${caseId}/vehicles/${vehicleId}/${crypto.randomUUID()}.${extOf(f.name, "jpg")}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKETS.intelligence)
          .upload(dest, buffer, { contentType: f.mime_type, upsert: false });
        if (!upErr) {
          const isPrimary = !vehiclePhotoSeen.has(vehicleId);
          await supabase.from("vehicle_photos").insert({
            vehicle_id: vehicleId,
            case_id: caseId,
            storage_path: dest,
            is_primary: isPrimary,
            uploaded_by: profile.id,
          });
          if (isPrimary) {
            await supabase.from("target_vehicles").update({ photo_url: dest }).eq("id", vehicleId);
            vehiclePhotoSeen.add(vehicleId);
          }
        }
      } else {
        await fileToEvidence(supabase, caseId, profile.id, f, buffer, cls, docByFile.get(f.name)?.doc_kind);
        continue;
      }
    } else {
      // Documents, screenshots, locations, "other", and all non-image files
      // (PDF/TXT) are retained as evidence so originals are always available.
      await fileToEvidence(supabase, caseId, profile.id, f, buffer, cls, docByFile.get(f.name)?.doc_kind);
    }

    // Remove the staged copy once handled.
    await supabase.storage.from(BUCKETS.evidence).remove([f.path]);
  }

  // Sweep any leftover staged files for this intake.
  await sweepStaging(supabase, input.intakeId);

  revalidatePath("/cases");
  return { ok: true, id: caseId };
}

async function fileToEvidence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
  profileId: string,
  f: IntakeStagedFile,
  buffer: Buffer,
  cls: IntakeImageClassification | undefined,
  docKind: string | undefined,
): Promise<void> {
  const dest = `${caseId}/${crypto.randomUUID()}.${extOf(f.name)}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.evidence)
    .upload(dest, buffer, { contentType: f.mime_type, upsert: false });
  if (upErr) return;
  await supabase.from("evidence").insert({
    case_id: caseId,
    type: detectEvidenceType(f.mime_type),
    category: docKind ?? cls?.kind ?? "intelligence",
    storage_path: dest,
    file_name: f.name,
    file_size: f.size,
    mime_type: f.mime_type,
    notes: `AI intake — ${f.name}`,
    uploaded_by: profileId,
  });
}

async function sweepStaging(
  supabase: Awaited<ReturnType<typeof createClient>>,
  intakeId: string,
): Promise<void> {
  const prefix = `${INTAKE_STAGING_PREFIX}/${intakeId}`;
  const { data: list } = await supabase.storage.from(BUCKETS.evidence).list(prefix);
  if (list && list.length > 0) {
    await supabase.storage.from(BUCKETS.evidence).remove(list.map((o) => `${prefix}/${o.name}`));
  }
}

/** Cleanup when the user abandons a review without confirming. */
export async function discardIntake(intakeId: string): Promise<{ ok: true }> {
  await requireStaff();
  const supabase = await createClient();
  await sweepStaging(supabase, intakeId);
  return { ok: true };
}
