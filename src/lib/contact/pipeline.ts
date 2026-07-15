/**
 * Contact Intelligence pipeline.
 *
 * Validates the identifier, ENCRYPTS it (never stores plaintext), records a root
 * row + blind index, runs the stages (Phase 1: phone parse + AI report; Phase 2
 * breach/accounts reported skipped), and persists results. All writes use the
 * service-role client AFTER the route authorized the caller.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  encryptField,
  createPhoneBlindIndex,
  createNameBlindIndex,
} from "@/lib/security/encryption";
import type {
  ContactRequest,
  ContactResult,
  ContactStageName,
  ContactStageStatus,
  PhoneInfo,
} from "./types";
import { parsePhone } from "./phone";
import { buildContactReverseLinks } from "./reverse";
import { getBreachAdapter, getUsernameAdapter } from "./providers";

export interface ContactPipelineContext {
  profileId: string;
  caseId: string | null;
}

/** Normalize + blind-index the input per type. */
function prepareInput(req: ContactRequest): { display: string; bidx: string; phone: PhoneInfo | null } {
  if (req.type === "phone") {
    const phone = parsePhone(req.value, req.region);
    return {
      display: phone.e164 ?? req.value.trim(),
      bidx: createPhoneBlindIndex(req.value),
      phone,
    };
  }
  const normalized = req.value.trim().toLowerCase();
  return { display: normalized, bidx: createNameBlindIndex(normalized), phone: null };
}

export async function runContactPipeline(
  req: ContactRequest,
  ctx: ContactPipelineContext,
): Promise<ContactResult> {
  const svc = createServiceClient();

  const { display, bidx, phone } = prepareInput(req);
  const breachAvail = getBreachAdapter().available;
  const accountsAvail = getUsernameAdapter().available;

  const stageStatus: ContactStageStatus = {
    input: "complete",
    phone: req.type === "phone" ? "processing" : "skipped",
    breach: req.type === "email" && breachAvail ? "processing" : "skipped",
    accounts: req.type === "username" && accountsAvail ? "processing" : "skipped",
  };

  // Root row — input stored ENCRYPTED + blind-indexed, never plaintext.
  const { data: created, error: insErr } = await svc
    .from("contact_analysis")
    .insert({
      created_by: ctx.profileId,
      case_id: ctx.caseId,
      input_type: req.type,
      input_enc: encryptField(req.value.trim()),
      input_bidx: bidx,
      status: "processing",
      stage_status: stageStatus,
    })
    .select("id")
    .single();
  if (insErr || !created) throw new Error(`Failed to create contact analysis: ${insErr?.message}`);
  const id: string = created.id;

  // Phone stage is already computed (parsePhone in prepareInput); mark it.
  if (req.type === "phone") stageStatus.phone = phone ? "complete" : "failed";

  const reverseSearch = buildContactReverseLinks(req.type, display, phone);

  // Persist child rows.
  await persist(svc, id, { phone });

  const anyFailed = Object.values(stageStatus).some((s) => s === "failed");
  await svc
    .from("contact_analysis")
    .update({ status: "complete", stage_status: stageStatus, error: anyFailed ? "one or more stages failed" : null })
    .eq("id", id);

  return {
    id,
    status: "complete",
    stageStatus,
    caseId: ctx.caseId,
    inputType: req.type,
    inputDisplay: display,
    phone,
    reverseSearch,
    error: anyFailed ? "one or more stages failed" : null,
  };
}

async function persist(
  svc: ReturnType<typeof createServiceClient>,
  analysisId: string,
  data: { phone: PhoneInfo | null },
): Promise<void> {
  const ops: PromiseLike<unknown>[] = [];

  if (data.phone) {
    const p = data.phone;
    ops.push(
      svc.from("contact_phone").insert({
        analysis_id: analysisId,
        valid: p.valid,
        possible: p.possible,
        e164_enc: p.e164 ? encryptField(p.e164) : null,
        national_fmt_enc: p.national ? encryptField(p.national) : null,
        country: p.country,
        line_type: p.lineType,
        raw: { international: p.international, country_calling_code: p.countryCallingCode },
      }),
    );
  }
  const results = await Promise.allSettled(ops);
  for (const res of results) {
    if (res.status === "rejected") console.error("[contact] persist failed:", res.reason);
  }
}
