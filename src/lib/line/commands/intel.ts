import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessages, type LineOutboundMessage } from "@/lib/line/reply";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptField } from "@/lib/security/encryption";
import { parseSocials } from "@/lib/socials";
import { BUCKETS } from "@/lib/constants";
import {
  CASE_NOT_FOUND,
  GENERIC_ERROR,
  INTEL_EMPTY_ARGS,
  RATE_LIMITED,
  formatIntelSummary,
  type IntelLocationInput,
  type IntelProfileInput,
  type IntelRelationshipInput,
  type IntelVehicleInput,
} from "@/lib/line/messages";
import { findAuthorizedCaseByNumber } from "@/lib/line/commands/shared";

/**
 * Handles the read-only "target intelligence" LINE-bot command (e.g.
 * "ข่าวกรอง <รหัสเคส>" / "intel <case>"). Wired up by src/lib/line/router.ts's
 * parseCommand()/handleLineMessage(), which guarantees `agentId` is an
 * already-linked, already-verified agent before this is ever called — same
 * contract as every other command handler in this directory.
 *
 * This is the highest-sensitivity surface this bot exposes: unlike the brief
 * `เคส` (case) summary, it returns curated target-profile fields plus
 * child-table intel (vehicles, locations, relationships, photos) for a case.
 *
 * ── Authorization ──────────────────────────────────────────────────────
 * Reuses findAuthorizedCaseByNumber() from ./shared.ts unchanged — the same
 * case_agents-membership check every other command in this bot uses. "No
 * such case" and "case exists but this agent isn't assigned" produce the
 * IDENTICAL CASE_NOT_FOUND reply (never a second/distinguishable string),
 * so an agent can't probe for case numbers that exist but aren't theirs.
 *
 * Every subsequent query (the intel-columns fetch on `cases`, plus
 * `target_vehicles`/`target_locations`/`target_relationships`/`target_photos`)
 * is scoped by `case_id = <the already-authorized case.id>` — never by the
 * raw, unauthenticated-adjacent `caseNumber` text again, and no additional
 * per-row case_agents check is needed since case_id itself is already trusted
 * at that point.
 *
 * `findAuthorizedCaseByNumber()`'s own CASE_SELECT does not include the
 * target-profile columns this command needs (it only decrypts
 * `target_name_enc` for the brief case summary) — rather than extending that
 * shared, multi-caller select (touched by case.ts/timeline.ts/add-timeline.ts
 * too), this command issues its own second `cases` query scoped by the
 * already-authorized `case.id`, keeping the shared helper's contract/callers
 * completely unchanged.
 *
 * ── Decryption ─────────────────────────────────────────────────────────
 * Only decrypted AFTER the authorization check above succeeds, and only the
 * columns actually surfaced in the reply (see formatIntelSummary()'s field
 * list in messages.ts) — `target_dob_enc`/`target_email_enc` and the legacy
 * single-value `cases.target_vehicle_enc`/`license_plate_enc` columns
 * (superseded by the `target_vehicles` table, which supports many vehicles)
 * are deliberately NOT fetched/decrypted here, per this module's explicit
 * "never decrypt speculatively" rule — there's no reason to decrypt a field
 * this command will never display. Each `_enc` field is decrypted
 * independently via safeDecrypt() (try/catch, degrade to null) so one bad
 * ciphertext never blows up the whole reply — mirrors shared.ts's
 * safeDecryptTargetName() pattern. `target_socials_enc` decrypts to a JSON
 * string, parsed defensively via src/lib/socials.ts's parseSocials() (which
 * itself try/catches malformed JSON and treats it as no socials).
 *
 * ── Scope ──────────────────────────────────────────────────────────────
 * Curated staff-entered data only: the case's target-profile fields,
 * `target_vehicles`, `target_locations`, `target_relationships`, and a
 * primary photo (target + primary vehicle). OSINT `image_analysis` /
 * `contact_analysis` / any AI-generated report content is explicitly OUT OF
 * SCOPE — lower-confidence, less-vetted AI output that is a separate,
 * deliberate product decision to ever surface via LINE.
 *
 * ── Photos ─────────────────────────────────────────────────────────────
 * Signed URLs (short TTL — this reply is consumed immediately by LINE, not
 * printed/archived) via BUCKETS.intelligence, mirroring
 * src/app/(dashboard)/timeline/actions.ts's fetchReportPhotos() pattern. Sent
 * as real LINE image messages via replyLineMessages(), capped at
 * MAX_PHOTOS (4) so `1 text message + N photos` never exceeds LINE's
 * 5-message-per-reply limit. A signed-URL failure for one photo just skips
 * that photo (logged), never the whole reply.
 *
 * ── Logging discipline ─────────────────────────────────────────────────
 * NEVER log decrypted target PII (name/phone/address/notes/socials/plate/
 * relationship name) at any log level, including error paths — only IDs,
 * counts, field *names* (not values), and booleans.
 */
const DISPLAY_CAP = 5;
/** 1 text summary + at most 4 photos = 5 messages, LINE's per-reply cap. */
const MAX_PHOTOS = 4;
/** Short-lived — this reply is rendered by LINE immediately, not printed or
 * archived, so there's no need for fetchReportPhotos()'s 1-hour TTL. */
const PHOTO_SIGNED_URL_TTL_SECONDS = 10 * 60;

/** Must stay a single string literal (not built via `+` concatenation) so
 * supabase-js can type-parse it into a proper row type rather than falling
 * back to a generic/untyped error type. */
const INTEL_PROFILE_SELECT =
  "target_name_enc, target_alias_enc, target_gender, target_age, target_nationality, target_occupation, target_phone_enc, target_address_enc, target_notes_enc, target_socials_enc";

export async function handleIntelCommand(
  agentId: string,
  caseNumber: string,
  replyToken: string,
): Promise<void> {
  const trimmedCaseNumber = caseNumber.trim();
  console.log(
    `[line:intel] invoked agentId=${agentId} caseNumberProvided=${Boolean(trimmedCaseNumber)}`,
  );

  if (!trimmedCaseNumber) {
    console.log(`[line:intel] empty-args agentId=${agentId}`);
    await replyLineMessages(replyToken, [{ type: "text", text: INTEL_EMPTY_ARGS }]);
    return;
  }

  const rl = await checkRateLimit("line_intel", agentId);
  if (!rl.allowed) {
    console.warn(`[line:intel] rate-limited agentId=${agentId}`);
    await replyLineMessages(replyToken, [{ type: "text", text: RATE_LIMITED }]);
    return;
  }

  const svc = createServiceClient();

  const resolved = await findAuthorizedCaseByNumber(svc, agentId, trimmedCaseNumber);
  if (resolved.error) {
    console.error(`[line:intel] case-lookup-failed agentId=${agentId}`, resolved.error);
    await replyLineMessages(replyToken, [{ type: "text", text: GENERIC_ERROR }]);
    return;
  }
  if (!resolved.data) {
    console.log(`[line:intel] case-not-found-or-unauthorized agentId=${agentId}`);
    await replyLineMessages(replyToken, [{ type: "text", text: CASE_NOT_FOUND }]);
    return;
  }

  const caseRow = resolved.data;
  console.log(`[line:intel] authorized agentId=${agentId} caseId=${caseRow.id}`);

  let decryptFailures = 0;
  /** Never let one corrupt ciphertext (bad key rotation, tampering) blow up
   * the whole reply — log the FIELD NAME only, never the raw ciphertext or
   * (obviously) any decrypted value. */
  function safeDecrypt(encrypted: string | null | undefined, field: string): string | null {
    if (!encrypted) return null;
    try {
      return decryptField(encrypted);
    } catch (err) {
      decryptFailures++;
      console.error(
        `[line:intel] decrypt-failed agentId=${agentId} caseId=${caseRow.id} field=${field}`,
        err,
      );
      return null;
    }
  }

  // Intel-specific profile columns, scoped by the already-authorized
  // case.id — NOT a fresh caseNumber lookup.
  const { data: profileRow, error: profileError } = await svc
    .from("cases")
    .select(INTEL_PROFILE_SELECT)
    .eq("id", caseRow.id)
    .maybeSingle();

  if (profileError || !profileRow) {
    console.error(
      `[line:intel] profile-fetch-failed agentId=${agentId} caseId=${caseRow.id}`,
      profileError,
    );
    await replyLineMessages(replyToken, [{ type: "text", text: GENERIC_ERROR }]);
    return;
  }

  // Child tables, each scoped by case_id = the already-authorized case.id —
  // no further per-row case_agents check needed. Ordered so an is_primary
  // row (vehicles) always sorts within the first DISPLAY_CAP rows.
  const [vehiclesResult, locationsResult, relationshipsResult, primaryPhotoResult] = await Promise.all([
    svc
      .from("target_vehicles")
      .select("make, model, color, license_plate_enc, is_primary, photo_url", { count: "exact" })
      .eq("case_id", caseRow.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(DISPLAY_CAP),
    svc
      .from("target_locations")
      .select("location_type, location_name, address_enc", { count: "exact" })
      .eq("case_id", caseRow.id)
      .order("created_at", { ascending: true })
      .limit(DISPLAY_CAP),
    svc
      .from("target_relationships")
      .select("name_enc, relation", { count: "exact" })
      .eq("case_id", caseRow.id)
      .order("created_at", { ascending: true })
      .limit(DISPLAY_CAP),
    svc
      .from("target_photos")
      .select("storage_path")
      .eq("case_id", caseRow.id)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  const childError =
    vehiclesResult.error ?? locationsResult.error ?? relationshipsResult.error ?? primaryPhotoResult.error;
  if (childError) {
    console.error(`[line:intel] child-query-failed agentId=${agentId} caseId=${caseRow.id}`, childError);
    await replyLineMessages(replyToken, [{ type: "text", text: GENERIC_ERROR }]);
    return;
  }

  // ── Decrypt profile fields (independent try/catch per field) ───────────
  const socialsJson = safeDecrypt(profileRow.target_socials_enc, "target_socials");
  let socials: { platform: string; handle: string }[] = [];
  if (socialsJson) {
    const { map, others } = parseSocials(socialsJson);
    socials = [
      ...(Object.entries(map) as [string, string | null][])
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([platform, handle]) => ({ platform, handle })),
      ...others
        .filter((o): o is { platform: string; handle: string } => Boolean(o.handle))
        .map((o) => ({ platform: o.platform, handle: o.handle })),
    ];
  }

  const profile: IntelProfileInput = {
    target_name: safeDecrypt(profileRow.target_name_enc, "target_name"),
    target_alias: safeDecrypt(profileRow.target_alias_enc, "target_alias"),
    target_gender: profileRow.target_gender,
    target_age: profileRow.target_age,
    target_nationality: profileRow.target_nationality,
    target_occupation: profileRow.target_occupation,
    target_phone: safeDecrypt(profileRow.target_phone_enc, "target_phone"),
    target_address: safeDecrypt(profileRow.target_address_enc, "target_address"),
    target_notes: safeDecrypt(profileRow.target_notes_enc, "target_notes"),
    target_socials: socials,
  };

  const vehicleRows = vehiclesResult.data ?? [];
  const vehicles: IntelVehicleInput[] = vehicleRows.map((v) => ({
    make: v.make,
    model: v.model,
    color: v.color,
    license_plate: safeDecrypt(v.license_plate_enc, "vehicle.license_plate"),
    is_primary: v.is_primary,
  }));
  const vehiclesTotal = vehiclesResult.count ?? vehicles.length;

  const locationRows = locationsResult.data ?? [];
  const locations: IntelLocationInput[] = locationRows.map((l) => ({
    location_type: l.location_type,
    location_name: l.location_name ?? safeDecrypt(l.address_enc, "location.address"),
  }));
  const locationsTotal = locationsResult.count ?? locations.length;

  const relationshipRows = relationshipsResult.data ?? [];
  const relationships: IntelRelationshipInput[] = relationshipRows.map((r) => ({
    name: safeDecrypt(r.name_enc, "relationship.name"),
    relation: r.relation,
  }));
  const relationshipsTotal = relationshipsResult.count ?? relationships.length;

  // ── Photos: primary target photo + primary vehicle's photo (if set) ────
  const photoPaths: string[] = [];
  if (primaryPhotoResult.data?.storage_path) photoPaths.push(primaryPhotoResult.data.storage_path);
  const primaryVehiclePhotoPath = vehicleRows.find((v) => v.is_primary && v.photo_url)?.photo_url;
  if (primaryVehiclePhotoPath) photoPaths.push(primaryVehiclePhotoPath);

  const cappedPhotoPaths = photoPaths.slice(0, MAX_PHOTOS);
  const imageMessages: LineOutboundMessage[] = [];
  if (cappedPhotoPaths.length > 0) {
    const { data: signed, error: signError } = await svc.storage
      .from(BUCKETS.intelligence)
      .createSignedUrls(cappedPhotoPaths, PHOTO_SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(`[line:intel] photo-sign-failed agentId=${agentId} caseId=${caseRow.id}`, signError);
    }
    for (const s of signed ?? []) {
      if (!s.signedUrl) {
        // Skip this photo only — never fail the whole reply over one bad URL.
        console.warn(`[line:intel] photo-sign-skip agentId=${agentId} caseId=${caseRow.id}`);
        continue;
      }
      imageMessages.push({ type: "image", originalContentUrl: s.signedUrl, previewImageUrl: s.signedUrl });
    }
  }

  const textMessage: LineOutboundMessage = {
    type: "text",
    text: formatIntelSummary({
      caseNumber: caseRow.case_number,
      profile,
      vehicles,
      vehiclesTotal,
      locations,
      locationsTotal,
      relationships,
      relationshipsTotal,
    }),
  };

  console.log(
    `[line:intel] success agentId=${agentId} caseId=${caseRow.id} vehicles=${vehiclesTotal} ` +
      `locations=${locationsTotal} relationships=${relationshipsTotal} photos=${imageMessages.length} ` +
      `decryptFailures=${decryptFailures}`,
  );

  await replyLineMessages(replyToken, [textMessage, ...imageMessages]);
}
