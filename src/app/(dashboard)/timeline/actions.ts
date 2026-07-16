"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff, requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";
import { notifyCaseParticipants } from "@/lib/notifications";
import { BUCKETS } from "@/lib/constants";
import type { LinkedEvidence, TimelineEntry } from "@/lib/types";

// Google Maps search link for a free-text place (timeline locations have no
// lat/lng). Pre-built and fed to the model so it copies the exact URL.
const mapsSearchLink = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

// Appended to every report system prompt: keep the provided map link after each location.
const MAP_LINK_RULE =
  `\n\nLOCATION MAP LINKS: every timeline entry that has a location is given with a Google Maps ` +
  `link in the form "[location] (Maps: <url>)". You MUST preserve that exact <url> immediately ` +
  `after the location wherever it appears in the report (keep the "(Maps: <url>)" suffix). ` +
  `Never modify, shorten, or invent a URL; if a location has no provided link, do not add one.`;

// ── Shared types (consumed by page.tsx and timeline-client.tsx) ───────────────
export type EntryFull = TimelineEntry & {
  agents: { full_name: string; agent_code: string } | null;
  cases: { case_number: string } | null;
};
export type DateGroup = { date: string; entries: EntryFull[] };
export type CaseGroup = { caseId: string; caseNumber: string; dates: DateGroup[] };

const CASES_PER_PAGE = 7;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function addTimelineEntry(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };
  const supabase = await createClient();

  // Staff may attribute a timeline entry to any agent via FormData agent_id (validated).
  // Agents resolve against their own session — FormData agent_id is ignored.
  let agentId: string | null = null;
  if (isStaff(profile.role)) {
    const formAgentId = String(formData.get("agent_id") ?? "").trim();
    if (formAgentId) {
      const { data: found } = await supabase
        .from("agents").select("id").eq("id", formAgentId).maybeSingle();
      if (!found) return { error: "Agent not found" };
      agentId = found.id;
    }
  } else {
    const { data: ownAgent } = await supabase
      .from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
    agentId = ownAgent?.id ?? null;
  }

  const caseId = String(formData.get("case_id") ?? "");
  const payload = {
    case_id: caseId,
    agent_id: agentId,
    entry_date: String(formData.get("entry_date") ?? "") || undefined,
    entry_time: String(formData.get("entry_time") ?? "") || undefined,
    entry: String(formData.get("entry") ?? "").trim(),
    location: emptyToNull(formData.get("location")),
  };

  if (!payload.entry) return { error: "Entry text is required" };

  const { data: inserted, error } = await supabase
    .from("timeline_entries")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: handleDbError(error, "timeline") };

  // Notify the rest of the case team (not the author, not the client).
  await notifyCaseParticipants(caseId, {
    type: "case",
    title: "New timeline entry",
    body: payload.entry.slice(0, 140),
    exclude: profile.id,
    includeClient: false,
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/timeline");
  return { ok: true, id: inserted.id as string };
}

export async function updateTimelineEntry(
  id: string,
  caseId: string,
  data: { entry_date: string; entry_time: string; entry: string; location: string | null },
) {
  const profile = await requireRole(["admin", "supervisor"]);
  const entry = data.entry.trim();
  if (!entry) return { error: "Entry text is required" };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("timeline_entries")
    .update({
      entry_date: data.entry_date,
      entry_time: data.entry_time,
      entry,
      location: data.location?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: handleDbError(error, "timeline") };
  // RLS (0048) restricts supervisor writes to assigned cases. A blocked write
  // returns no error but affects 0 rows — surface that instead of faking success.
  if (!updated || updated.length === 0) {
    return { error: "Not authorized to edit this entry, or it no longer exists" };
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/timeline");
  return { ok: true };
}

export async function deleteTimelineEntry(id: string, caseId: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: deleted, error } = await supabase
    .from("timeline_entries")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: handleDbError(error, "timeline") };
  // See updateTimelineEntry: 0 rows = RLS-blocked or already deleted.
  if (!deleted || deleted.length === 0) {
    return { error: "Not authorized to delete this entry, or it no longer exists" };
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/timeline");
  return { ok: true };
}

// ─── AI helpers ───────────────────────────────────────────────────────────────

const AI_MODEL = process.env.AI_REPORT_MODEL ?? "claude-sonnet-4-6";

async function callAnthropicRaw(
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; stop_reason: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }
  const data = await res.json();
  return {
    text: data?.content?.[0]?.text ?? "",
    stop_reason: data?.stop_reason ?? "unknown",
  };
}

async function callAnthropic(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const { text } = await callAnthropicRaw(system, user, maxTokens);
  return text;
}

export async function parseTimelineEntry(
  rawText: string,
  defaultDate: string,
): Promise<{ time: string; date: string; entry: string; error?: string }> {
  const trimmed = rawText.trim().slice(0, 1000);
  if (!trimmed) return { time: "", date: defaultDate, entry: "", error: "Entry text is required" };

  if (!process.env.ANTHROPIC_API_KEY) {
    // Regex fallback
    const match = trimmed.match(/\b(\d{1,2})[.:h](\d{2})\b/);
    const h = match ? match[1].padStart(2, "0") : new Date().getHours().toString().padStart(2, "0");
    const m = match ? match[2] : new Date().getMinutes().toString().padStart(2, "0");
    return { time: `${h}:${m}`, date: defaultDate, entry: trimmed };
  }

  try {
    const system = `You are a surveillance timeline parser. Extract time, date, and rewrite as professional English. Return JSON only: {"time": "HH:MM", "date": "YYYY-MM-DD", "entry": "Professional description"}. Rules: time in 24h format; if missing use current time. Date: use defaultDate unless explicitly stated, defaultDate is ${defaultDate}. Entry: professional surveillance English, translate Thai to English, start with 'The subject' or action verb. No markdown, no explanation, just JSON.`;
    const text = await callAnthropic(system, `Field note: "${trimmed}"`, 200);
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return {
      time: parsed.time ?? "",
      date: parsed.date ?? defaultDate,
      entry: parsed.entry ?? trimmed,
    };
  } catch {
    return { time: "", date: defaultDate, entry: trimmed, error: "AI parsing failed" };
  }
}

// ─── Multi-entry parse ────────────────────────────────────────────────────────

type ParsedEntry = { time: string; date: string; entry: string };

// Regex to detect an ISO or recognisable English date on a line by itself.
// Thai dates require the AI path; the regex fallback uses this to skip date-only lines.
const DATE_LINE_RE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})$/i;

function parseWithRegex(rawText: string, defaultDate: string): ParsedEntry[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries: ParsedEntry[] = [];
  let current: { time: string; date: string; lines: string[] } | null = null;
  let activeDate = defaultDate;
  const TIME_START = /^(\d{1,2})[.:h\-](\d{2})\b/;

  for (const line of lines) {
    // Skip lines that look like standalone date headers
    if (DATE_LINE_RE.test(line)) continue;

    const m = line.match(TIME_START);
    if (m) {
      if (current) {
        entries.push({ time: current.time, date: current.date, entry: current.lines.join(" ") });
      }
      const h = m[1].padStart(2, "0");
      const min = m[2];
      const rest = line.slice(m[0].length).trim();
      current = { time: `${h}:${min}`, date: activeDate, lines: rest ? [rest] : [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      // No time marker found yet — treat whole block as single entry
      const now = new Date();
      const t = now.toTimeString().slice(0, 5);
      entries.push({ time: t, date: activeDate, entry: rawText });
      return entries;
    }
  }
  if (current) {
    entries.push({ time: current.time, date: current.date, entry: current.lines.join(" ") });
  }
  if (!entries.length) {
    const now = new Date();
    const t = now.toTimeString().slice(0, 5);
    return [{ time: t, date: defaultDate, entry: rawText }];
  }
  // Sort by date ASC, time ASC
  return entries.sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time),
  );
}

export async function parseMultipleEntries(
  rawText: string,
  defaultDate: string,
): Promise<{ entries?: ParsedEntry[]; error?: string }> {
  const trimmed = rawText.trim().slice(0, 5000);
  if (!trimmed) return { error: "Entry text is required" };

  // Step 1: Always split with regex first — this is deterministic and never collapses entries.
  // The AI's only job below is to enhance the descriptions, not control splitting.
  const regexEntries = parseWithRegex(trimmed, defaultDate);

  // Step 2: No API key — return regex results as-is.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { entries: regexEntries };
  }

  // Step 3: Use AI to enhance descriptions on the already-split segments.
  // The AI receives a numbered list and must return the same count.
  // time and date from the regex are always used as ground truth.
  const segments = regexEntries
    .map((e, i) => `[${i + 1}] time=${e.time} | description="${e.entry}"`)
    .join("\n");

  const system = `You are a professional surveillance language editor for a Thai detective agency.

You will receive a numbered list of pre-split surveillance timeline entries. Each has a time and description.
Your ONLY job is to rewrite each description into professional surveillance language.

CRITICAL RULES:
1. Return EXACTLY ${regexEntries.length} entries — one per input line. Never add, merge, or remove entries.
2. Keep "time" and "date" values EXACTLY as provided. Do NOT change them.
3. LANGUAGE: If description is Thai → professional Thai (do NOT translate to English). If English → professional English.
4. If description is empty → use "(ไม่มีรายละเอียด)" for a Thai-context entry, "(no description)" for English.
5. Thai descriptions start with "ผู้ต้องสงสัย" or an appropriate Thai surveillance verb.
6. English descriptions start with "The subject" or an action verb.

Thai examples:
  "" → "(ไม่มีรายละเอียด)"
  "เป้าหมายออกจากบ้าน" → "ผู้ต้องสงสัยออกจากที่พักอาศัย"
  "เป้าหมายเข้าสตาร์บัค" → "ผู้ต้องสงสัยเดินทางเข้าร้าน Starbucks"

English examples:
  "" → "(no description)"
  "target left home" → "The subject departed from the residence."

Return ONLY a JSON array with exactly ${regexEntries.length} objects:
[{"time":"HH:MM","date":"YYYY-MM-DD","entry":"..."},...]
No markdown. No explanation. Only the JSON array.`;

  try {
    const text = await callAnthropic(
      system,
      `Enhance these ${regexEntries.length} entries:\n${segments}`,
      Math.min(150 * regexEntries.length + 200, 4000),
    );
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No array in response");
    const aiParsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    // If the AI returns a different count, fall back to regex results — don't merge.
    if (!Array.isArray(aiParsed) || aiParsed.length !== regexEntries.length) {
      throw new Error(`Count mismatch: expected ${regexEntries.length}, got ${aiParsed?.length}`);
    }

    const entries: ParsedEntry[] = aiParsed.map(
      (p: { entry?: string }, i: number) => ({
        time: regexEntries[i].time,   // regex time is ground truth
        date: regexEntries[i].date,   // regex date is ground truth
        entry: String(p.entry ?? "").trim() || "(no description)",
      }),
    );

    return { entries };
  } catch {
    // AI failed or returned wrong count — use the regex split as-is.
    return { entries: regexEntries };
  }
}

export async function addMultipleTimelineEntries(
  entries: Array<{
    caseId: string;
    date: string;
    time: string;
    entry: string;
    location: string;
  }>,
): Promise<{ count?: number; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (profile.role === "client") return { error: "Not authorized" };

  if (!entries.length) return { error: "No entries provided" };

  const supabase = await createClient();

  // Resolve the calling user's own agent record for attribution.
  // Staff who need to attribute entries to a different agent should use
  // addTimelineEntry() per row (which accepts an agent_id in FormData).
  const { data: ag } = await supabase
    .from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
  const agentId = ag?.id ?? null;

  const rows = entries.map((e) => {
    const timeParts = e.time.split(":");
    const entryTime = timeParts.length === 2 ? `${e.time}:00` : e.time;
    return {
      case_id: e.caseId,
      agent_id: agentId,
      entry_date: e.date,
      entry_time: entryTime,
      entry: e.entry,
      location: e.location?.trim() || null,
    };
  });

  const { error } = await supabase.from("timeline_entries").insert(rows);
  if (error) return { error: handleDbError(error, "timeline") };

  // Revalidate all affected case paths + notify each case team once.
  const caseIds = [...new Set(entries.map((e) => e.caseId))];
  for (const caseId of caseIds) {
    revalidatePath(`/cases/${caseId}`);
    const added = entries.filter((e) => e.caseId === caseId).length;
    await notifyCaseParticipants(caseId, {
      type: "case",
      title: "New timeline entries",
      body: `${added} ${added === 1 ? "entry" : "entries"} added to the case.`,
      exclude: profile.id,
      includeClient: false,
    });
  }
  revalidatePath("/timeline");

  return { count: rows.length };
}

export async function improveTimelineEntry(
  text: string,
): Promise<{ improved?: string; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "AI not configured" };
  }
  try {
    const system =
      "Rewrite as professional surveillance language. Third person. Past tense. Factual, concise. Return ONLY the rewritten text, no quotes, no explanation.\n" +
      "If input is Thai: output Professional Thai (maintain Thai language). Start with 'ผู้ต้องสงสัย' or appropriate Thai surveillance verb.\n" +
      "If input is English: output Professional English. Start with 'The subject' or action verb.";
    const improved = await callAnthropic(system, text, 300);
    return { improved: improved.trim() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI improvement failed" };
  }
}

export type ReportType = "thai_client" | "english_client" | "internal";

const FACTUAL_RULES_EN = `CRITICAL RULES — FACTUAL OBSERVATIONS ONLY:
- Record ONLY what was directly observed and recorded. Never infer, assume, speculate, interpret, or assess.
- Forbidden words and phrases: "appeared", "seemed", "likely", "assessed", "believed", "routine behavior", "no suspicious activity", "subject remained inside", "possibly", "probably", "may have".
- Do NOT write an Executive Summary, Key Findings, Remarks, Recommendations, Conclusions, or any closing observation.
- The report ends immediately after the final chronological entry, followed by "End of Report" on its own line.
- No additional text after "End of Report".`;

const FACTUAL_RULES_TH = `กฎเด็ดขาด — บันทึกเฉพาะที่สังเกตเห็นโดยตรงเท่านั้น:
- ห้ามสรุป อนุมาน คาดเดา หรือตีความพฤติกรรม
- ห้ามใช้คำว่า "ดูเหมือน" "น่าจะ" "คาดว่า" "ประเมินว่า" "พฤติกรรมปกติ" "ไม่พบพฤติกรรมน่าสงสัย" "อาจจะ"
- ห้ามเขียนบทสรุป ข้อสังเกตสำคัญ หมายเหตุ หรือคำแนะนำใด ๆ
- รายงานสิ้นสุดทันทีหลังรายการสุดท้าย ตามด้วย "สิ้นสุดรายงาน" บนบรรทัดใหม่
- ไม่มีข้อความใด ๆ หลัง "สิ้นสุดรายงาน"`;

function formatThaiDate(isoDate: string): string {
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${thaiMonths[month - 1]} ${year + 543}`;
}

function buildFallbackReport(
  reportType: ReportType,
  caseNumber: string,
  date: string,
  entries: Array<{ entry_time: string; entry: string; location: string | null }>,
): string {
  const thaiDate = formatThaiDate(date);
  const lines = entries.map(
    (e) => `${e.entry_time.slice(0, 5)} น. — ${e.entry}${e.location ? ` [${e.location}]` : ""}`,
  );

  if (reportType === "thai_client") {
    return `รายงานการเฝ้าสังเกตการณ์ประจำวัน
==================================
เลขคดี: ${caseNumber}
วันที่: ${thaiDate}

ลำดับการสังเกตการณ์
--------------------
${lines.length ? lines.join("\n") : "(ไม่มีรายการบันทึก)"}

สิ้นสุดรายงาน`;
  }

  if (reportType === "english_client") {
    const obsLines = entries.map(
      (e) => `${e.entry_time.slice(0, 5)} hrs — ${e.entry}${e.location ? ` [${e.location}]` : ""}`,
    );
    return `DAILY SURVEILLANCE REPORT
=========================
Case Number: ${caseNumber}
Date: ${date}

CHRONOLOGICAL OBSERVATIONS
--------------------------
${obsLines.length ? obsLines.join("\n") : "(No entries recorded)"}

End of Report`;
  }

  // internal
  const obsLines = entries.map(
    (e) => `${e.entry_time.slice(0, 5)} hrs — ${e.entry}${e.location ? ` [${e.location}]` : ""}`,
  );
  return `SURVEILLANCE OPERATIONS REPORT
===============================
Case: ${caseNumber}
Date: ${date}

CHRONOLOGICAL OBSERVATIONS
--------------------------
${obsLines.length ? obsLines.join("\n") : "(No entries recorded)"}

End of Report`;
}

export type ReportPhoto = { url: string; label: string };

/**
 * Fetch the `photo` evidence linked to the given timeline entries → short-lived
 * signed URLs + a label (entry date/time + snippet), so a report can embed the
 * actual photos, not just the "[N photos attached]" note. Non-fatal: returns []
 * on any miss so report generation never fails over evidence.
 */
async function fetchReportPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entries: Array<{ id: string; entry_time: string; entry: string; entry_date?: string }>,
): Promise<ReportPhoto[]> {
  if (entries.length === 0) return [];
  try {
  const byId = new Map(entries.map((e) => [e.id, e]));

  const { data: evRows, error: evErr } = await supabase
    .from("evidence")
    .select("timeline_entry_id, storage_path, type, created_at")
    .in("timeline_entry_id", entries.map((e) => e.id))
    .eq("type", "photo")
    .order("created_at", { ascending: true });
  if (evErr) console.error("[report-photos] evidence query error:", evErr.message);

  const rows = (evRows ?? []).filter(
    (r) => !!r.timeline_entry_id && !!r.storage_path,
  ) as Array<{ timeline_entry_id: string; storage_path: string }>;
  if (rows.length === 0) return [];

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKETS.evidence)
    .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60); // 1h TTL — long enough to print
  if (signErr) console.error("[report-photos] sign error:", signErr.message);
  const urlByPath = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl && s.path)
      .map((s) => [s.path as string, s.signedUrl as string]),
  );

  const photos: ReportPhoto[] = [];
  for (const r of rows) {
    const url = urlByPath.get(r.storage_path);
    if (!url) continue;
    const e = byId.get(r.timeline_entry_id);
    const time = e?.entry_time?.slice(0, 5) ?? "";
    const datePart = e?.entry_date ? `${e.entry_date} ` : "";
    const snippet = e?.entry
      ? e.entry.length > 90 ? `${e.entry.slice(0, 90)}…` : e.entry
      : "";
    photos.push({ url, label: [`${datePart}${time}`.trim(), snippet].filter(Boolean).join(" — ") });
  }
  console.log(`[report-photos] entries=${entries.length} evRows=${(evRows ?? []).length} rows=${rows.length} signed=${(signed ?? []).length} photos=${photos.length}`);
  return photos;
  } catch {
    // Never let an evidence/storage hiccup fail the whole report — degrade to
    // a text-only report (no embedded photos).
    return [];
  }
}

export async function generateReport(
  caseId: string,
  date: string,
  reportType: ReportType,
): Promise<{ report?: string; photos?: ReportPhoto[]; error?: string }> {
  // Auth: must be an authenticated, non-client user. Case access is enforced
  // below via the RLS-scoped cases lookup (admins see all, supervisors via
  // is_staff, agents only their assigned cases). Blocks invoking the paid AI
  // endpoint for cases the caller cannot access.
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "client") return { error: "Not authorized" };

  const supabase = await createClient();

  const [entriesRes, caseRes] = await Promise.all([
    supabase
      .from("timeline_entries")
      .select("id, entry_time, entry, location")
      .eq("case_id", caseId)
      .eq("entry_date", date)
      .is("deleted_at", null)
      .order("entry_time", { ascending: true }),
    supabase.from("cases").select("case_number, client_name").eq("id", caseId).maybeSingle(),
  ]);

  const entries = entriesRes.data ?? [];
  const caseRow = caseRes.data;
  if (!caseRow) return { error: "Case not found or access denied" };
  const caseNumber = caseRow.case_number ?? caseId;

  // Count linked evidence per entry to include in report observations.
  let evidenceCountByEntryId: Record<string, number> = {};
  if (entries.length > 0) {
    const { data: evRows } = await supabase
      .from("evidence")
      .select("timeline_entry_id")
      .in("timeline_entry_id", entries.map((e) => e.id));
    for (const row of evRows ?? []) {
      if (row.timeline_entry_id) {
        evidenceCountByEntryId[row.timeline_entry_id] =
          (evidenceCountByEntryId[row.timeline_entry_id] ?? 0) + 1;
      }
    }
  }

  const photos = await fetchReportPhotos(supabase, entries);

  const timelineText = entries.length
    ? entries
        .map((e) => {
          const evCount = evidenceCountByEntryId[e.id] ?? 0;
          const evNote = evCount > 0 ? ` [${evCount} photo${evCount > 1 ? "s" : ""} attached]` : "";
          return `${e.entry_time.slice(0, 5)} — ${e.entry}${e.location ? ` [${e.location}] (Maps: ${mapsSearchLink(e.location)})` : ""}${evNote}`;
        })
        .join("\n")
    : "(ไม่มีรายการบันทึก / No entries recorded)";

  if (!process.env.ANTHROPIC_API_KEY) {
    return { report: buildFallbackReport(reportType, caseNumber, date, entries), photos };
  }

  const thaiDate = formatThaiDate(date);

  const prompts: Record<ReportType, string> = {
    thai_client: `คุณเป็นนักเขียนรายงานการเฝ้าสังเกตการณ์ระดับมืออาชีพ

จงเขียนรายงานการเฝ้าสังเกตการณ์เป็นภาษาไทยทางการ โดยใช้รูปแบบด้านล่างนี้เท่านั้น:

รายงานการเฝ้าสังเกตการณ์ประจำวัน
==================================
เลขคดี: ${caseNumber}
วันที่: ${thaiDate}

ลำดับการสังเกตการณ์
--------------------
[สำหรับทุกรายการ: HH:MM น. — การสังเกตการณ์]

สิ้นสุดรายงาน

${FACTUAL_RULES_TH}

รูปแบบแต่ละรายการ: "HH:MM น. — [การสังเกตการณ์เป็นภาษาไทยทางการ]"
ใช้คำว่า "ผู้ต้องสงสัย" หรือ "บุคคลเป้าหมาย" เท่านั้น
แปลงบันทึกภาคสนามเป็นภาษาไทยทางการ ห้ามเพิ่มเนื้อหาใด ๆ ที่ไม่มีในบันทึกต้นฉบับ
Return only the report text, no extra explanation.`,

    english_client: `You are a professional surveillance report writer.

Write a daily surveillance report in English using ONLY the format below:

DAILY SURVEILLANCE REPORT
=========================
Case Number: ${caseNumber}
Date: ${date}

CHRONOLOGICAL OBSERVATIONS
--------------------------
[For every entry: HH:MM hrs — observation]

End of Report

${FACTUAL_RULES_EN}

Format each entry as: "HH:MM hrs — [observation in professional English, third person, past tense]"
Use "the subject" or "the individual". Convert field notes into professional surveillance English.
Do NOT add any content not present in the original notes.
Return only the report text, no extra explanation.`,

    internal: `You are writing an internal surveillance operations report.

Write the report using ONLY the format below:

SURVEILLANCE OPERATIONS REPORT
===============================
Case: ${caseNumber}
Date: ${date}

CHRONOLOGICAL OBSERVATIONS
--------------------------
[For every entry: HH:MM hrs — observation]

End of Report

${FACTUAL_RULES_EN}

Format each entry as: "HH:MM hrs — [observation preserving all operational detail: vehicles, locations, descriptions]"
Preserve every operational detail from the original notes exactly as recorded.
Do NOT add any content not present in the original notes.
Return only the report text, no extra explanation.`,
  };

  const INITIAL_TOKENS = 4000;
  const RETRY_TOKENS   = 8000;

  try {
    const system = prompts[reportType] + MAP_LINK_RULE;
    const user = `Case: ${caseNumber}\nDate: ${date}\n\nTimeline:\n${timelineText}`;

    let result = await callAnthropicRaw(system, user, INITIAL_TOKENS);

    console.log("[generateReport]", {
      model: AI_MODEL,
      max_tokens: INITIAL_TOKENS,
      stop_reason: result.stop_reason,
      input_length: user.length,
      output_length: result.text.length,
      entry_count: entries.length,
    });

    if (result.stop_reason === "max_tokens") {
      console.log("[generateReport] truncated — retrying with", RETRY_TOKENS, "tokens");
      result = await callAnthropicRaw(system, user, RETRY_TOKENS);
      console.log("[generateReport] retry", {
        model: AI_MODEL,
        max_tokens: RETRY_TOKENS,
        stop_reason: result.stop_reason,
        output_length: result.text.length,
      });
    }

    // If still truncated after retry, append a visible warning rather than silently returning partial text.
    if (result.stop_reason === "max_tokens") {
      return {
        report: result.text.trimEnd() +
          "\n\n⚠️ รายงานถูกตัดทอนเนื่องจากข้อมูลมีขนาดใหญ่เกินไป กรุณากด Download TXT เพื่อรับรายงานฉบับเต็ม" +
          "\n⚠️ Report truncated due to data size. Use Download TXT for the complete report.",
        photos,
      };
    }

    return { report: result.text.trim(), photos };
  } catch (err) {
    return { report: buildFallbackReport(reportType, caseNumber, date, entries), photos };
  }
}

// ── Multi-day / date-range report ───────────────────────────────────────────────

type RangeEntry = { entry_date: string; entry_time: string; entry: string; location: string | null };

function groupByDate(entries: RangeEntry[]): Array<{ date: string; entries: RangeEntry[] }> {
  const map = new Map<string, RangeEntry[]>();
  for (const e of entries) {
    if (!map.has(e.entry_date)) map.set(e.entry_date, []);
    map.get(e.entry_date)!.push(e);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({ date, entries: list }));
}

function buildRangeFallbackReport(
  reportType: ReportType,
  caseNumber: string,
  startDate: string,
  endDate: string,
  entries: RangeEntry[],
): string {
  const days = groupByDate(entries);
  const isThai = reportType === "thai_client";

  if (isThai) {
    const sections = days.length
      ? days
          .map((d) => {
            const lines = d.entries.map(
              (e) => `${e.entry_time.slice(0, 5)} น. — ${e.entry}${e.location ? ` [${e.location}]` : ""}`,
            );
            return `วันที่: ${formatThaiDate(d.date)}\n--------------------\n${lines.join("\n")}`;
          })
          .join("\n\n")
      : "(ไม่มีรายการบันทึก)";
    return `รายงานการเฝ้าสังเกตการณ์
==================================
เลขคดี: ${caseNumber}
ช่วงวันที่: ${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}

${sections}

สิ้นสุดรายงาน`;
  }

  const heading = reportType === "internal" ? "SURVEILLANCE OPERATIONS REPORT" : "DAILY SURVEILLANCE REPORT";
  const sections = days.length
    ? days
        .map((d) => {
          const lines = d.entries.map(
            (e) => `${e.entry_time.slice(0, 5)} hrs — ${e.entry}${e.location ? ` [${e.location}]` : ""}`,
          );
          return `Date: ${d.date}\n--------------------\n${lines.join("\n")}`;
        })
        .join("\n\n")
    : "(No entries recorded)";
  return `${heading}
=========================
Case Number: ${caseNumber}
Period: ${startDate} to ${endDate}

${sections}

End of Report`;
}

export async function generateRangeReport(
  caseId: string,
  startDate: string,
  endDate: string,
  reportType: ReportType,
): Promise<{ report?: string; photos?: ReportPhoto[]; error?: string }> {
  // Auth: authenticated, non-client only. Case access enforced via the
  // RLS-scoped cases lookup below (see generateReport).
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "client") return { error: "Not authorized" };

  if (startDate > endDate) {
    return { error: "Start date must be on or before end date." };
  }

  const supabase = await createClient();

  const [entriesRes, caseRes] = await Promise.all([
    supabase
      .from("timeline_entries")
      .select("id, entry_date, entry_time, entry, location")
      .eq("case_id", caseId)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .is("deleted_at", null)
      .order("entry_date", { ascending: true })
      .order("entry_time", { ascending: true }),
    supabase.from("cases").select("case_number, client_name").eq("id", caseId).maybeSingle(),
  ]);

  const entries = (entriesRes.data ?? []) as Array<RangeEntry & { id: string }>;
  const caseRow = caseRes.data;
  if (!caseRow) return { error: "Case not found or access denied" };
  const caseNumber = caseRow.case_number ?? caseId;

  // Count linked evidence per entry to surface in observations.
  const evidenceCountByEntryId: Record<string, number> = {};
  if (entries.length > 0) {
    const { data: evRows } = await supabase
      .from("evidence")
      .select("timeline_entry_id")
      .in("timeline_entry_id", entries.map((e) => e.id));
    for (const row of evRows ?? []) {
      if (row.timeline_entry_id) {
        evidenceCountByEntryId[row.timeline_entry_id] =
          (evidenceCountByEntryId[row.timeline_entry_id] ?? 0) + 1;
      }
    }
  }

  const photos = await fetchReportPhotos(supabase, entries);

  const days = groupByDate(entries);
  const timelineText = days.length
    ? days
        .map((d) => {
          const header = reportType === "thai_client"
            ? `=== ${formatThaiDate(d.date)} (${d.date}) ===`
            : `=== ${d.date} ===`;
          const lines = d.entries.map((e) => {
            const id = (e as RangeEntry & { id: string }).id;
            const evCount = evidenceCountByEntryId[id] ?? 0;
            const evNote = evCount > 0 ? ` [${evCount} photo${evCount > 1 ? "s" : ""} attached]` : "";
            return `${e.entry_time.slice(0, 5)} — ${e.entry}${e.location ? ` [${e.location}] (Maps: ${mapsSearchLink(e.location)})` : ""}${evNote}`;
          });
          return `${header}\n${lines.join("\n")}`;
        })
        .join("\n\n")
    : "(ไม่มีรายการบันทึก / No entries recorded)";

  if (!process.env.ANTHROPIC_API_KEY) {
    return { report: buildRangeFallbackReport(reportType, caseNumber, startDate, endDate, entries), photos };
  }

  const thaiStart = formatThaiDate(startDate);
  const thaiEnd = formatThaiDate(endDate);

  const prompts: Record<ReportType, string> = {
    thai_client: `คุณเป็นนักเขียนรายงานการเฝ้าสังเกตการณ์ระดับมืออาชีพ

จงเขียนรายงานการเฝ้าสังเกตการณ์หลายวันเป็นภาษาไทยทางการ โดยใช้รูปแบบด้านล่างนี้เท่านั้น:

รายงานการเฝ้าสังเกตการณ์
==================================
เลขคดี: ${caseNumber}
ช่วงวันที่: ${thaiStart} - ${thaiEnd}

[สำหรับแต่ละวันที่มีรายการ ให้ขึ้นหัวข้อวันที่ แล้วตามด้วยรายการตามลำดับเวลา]
วันที่: [วันที่ภาษาไทย]
--------------------
[HH:MM น. — การสังเกตการณ์]

สิ้นสุดรายงาน

${FACTUAL_RULES_TH}

จัดรายการตามวันที่ เรียงตามเวลาในแต่ละวัน
รูปแบบแต่ละรายการ: "HH:MM น. — [การสังเกตการณ์เป็นภาษาไทยทางการ]"
ใช้คำว่า "ผู้ต้องสงสัย" หรือ "บุคคลเป้าหมาย" เท่านั้น
แปลงบันทึกภาคสนามเป็นภาษาไทยทางการ ห้ามเพิ่มเนื้อหาใด ๆ ที่ไม่มีในบันทึกต้นฉบับ
Return only the report text, no extra explanation.`,

    english_client: `You are a professional surveillance report writer.

Write a multi-day surveillance report in English using ONLY the format below:

DAILY SURVEILLANCE REPORT
=========================
Case Number: ${caseNumber}
Period: ${startDate} to ${endDate}

[For each day that has entries, start a dated section then list its observations chronologically]
Date: [date]
--------------------
[HH:MM hrs — observation]

End of Report

${FACTUAL_RULES_EN}

Group observations under each date, ordered by time within each day.
Format each entry as: "HH:MM hrs — [observation in professional English, third person, past tense]"
Use "the subject" or "the individual". Convert field notes into professional surveillance English.
Do NOT add any content not present in the original notes.
Return only the report text, no extra explanation.`,

    internal: `You are writing an internal multi-day surveillance operations report.

Write the report using ONLY the format below:

SURVEILLANCE OPERATIONS REPORT
===============================
Case: ${caseNumber}
Period: ${startDate} to ${endDate}

[For each day that has entries, start a dated section then list its observations chronologically]
Date: [date]
--------------------
[HH:MM hrs — observation]

End of Report

${FACTUAL_RULES_EN}

Group observations under each date, ordered by time within each day.
Format each entry as: "HH:MM hrs — [observation preserving all operational detail: vehicles, locations, descriptions]"
Preserve every operational detail from the original notes exactly as recorded.
Do NOT add any content not present in the original notes.
Return only the report text, no extra explanation.`,
  };

  // Range reports can be large; start higher and retry once if truncated.
  const INITIAL_TOKENS = 8000;
  const RETRY_TOKENS = 16000;

  try {
    const system = prompts[reportType] + MAP_LINK_RULE;
    const user = `Case: ${caseNumber}\nPeriod: ${startDate} to ${endDate}\n\nTimeline:\n${timelineText}`;

    let result = await callAnthropicRaw(system, user, INITIAL_TOKENS);

    console.log("[generateRangeReport]", {
      model: AI_MODEL,
      max_tokens: INITIAL_TOKENS,
      stop_reason: result.stop_reason,
      input_length: user.length,
      output_length: result.text.length,
      day_count: days.length,
      entry_count: entries.length,
    });

    if (result.stop_reason === "max_tokens") {
      console.log("[generateRangeReport] truncated — retrying with", RETRY_TOKENS, "tokens");
      result = await callAnthropicRaw(system, user, RETRY_TOKENS);
    }

    if (result.stop_reason === "max_tokens") {
      return {
        report: result.text.trimEnd() +
          "\n\n⚠️ รายงานถูกตัดทอนเนื่องจากข้อมูลมีขนาดใหญ่เกินไป กรุณาลดช่วงวันที่หรือกด Download TXT" +
          "\n⚠️ Report truncated due to data size. Narrow the date range or use Download TXT.",
        photos,
      };
    }

    return { report: result.text.trim(), photos };
  } catch {
    return { report: buildRangeFallbackReport(reportType, caseNumber, startDate, endDate, entries), photos };
  }
}

// ── Pagination ────────────────────────────────────────────────────────────────

export async function loadMoreCaseGroups(
  alreadyLoadedCaseIds: string[],
  filters: { q?: string; from?: string; to?: string },
): Promise<{ caseGroups: CaseGroup[]; hasMore: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile) return { caseGroups: [], hasMore: false };

  const supabase = await createClient();

  // Scope query to the user's assigned cases for non-admin roles
  let caseIdFilter: string[] | null = null;
  if (profile.role !== "admin") {
    const { data: agentRow } = await supabase
      .from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
    if (!agentRow) return { caseGroups: [], hasMore: false };

    const { data: caseAgents } = await supabase
      .from("case_agents").select("case_id").eq("agent_id", agentRow.id);

    const allMyCaseIds = (caseAgents ?? []).map((ca) => ca.case_id);
    const remaining = allMyCaseIds.filter((id) => !alreadyLoadedCaseIds.includes(id));
    if (remaining.length === 0) return { caseGroups: [], hasMore: false };
    caseIdFilter = remaining;
  }

  let query = supabase
    .from("timeline_entries")
    .select("*, agents(full_name, agent_code), cases(case_number)")
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false })
    .limit(500);

  if (caseIdFilter) {
    query = query.in("case_id", caseIdFilter);
  } else if (alreadyLoadedCaseIds.length > 0) {
    query = query.not("case_id", "in", `(${alreadyLoadedCaseIds.join(",")})`);
  }

  if (filters.from) query = query.gte("entry_date", filters.from);
  if (filters.to) query = query.lte("entry_date", filters.to);

  const { data: rawEntries } = await query;
  let allEntries = (rawEntries ?? []) as EntryFull[];

  if (filters.q) {
    const search = filters.q.toLowerCase().trim();
    allEntries = allEntries.filter((e) =>
      (e.cases?.case_number ?? "").toLowerCase().includes(search) ||
      (e.entry ?? "").toLowerCase().includes(search) ||
      (e.location ?? "").toLowerCase().includes(search),
    );
  }

  // Collect entries for the first CASES_PER_PAGE unique cases (newest-first order)
  const caseOrder: string[] = [];
  const caseMap = new Map<string, { caseNumber: string; dateMap: Map<string, EntryFull[]> }>();

  for (const entry of allEntries) {
    const isNew = !caseMap.has(entry.case_id);
    if (isNew && caseOrder.length >= CASES_PER_PAGE) break;
    if (isNew) {
      caseOrder.push(entry.case_id);
      caseMap.set(entry.case_id, {
        caseNumber: entry.cases?.case_number ?? entry.case_id,
        dateMap: new Map(),
      });
    }
    const cd = caseMap.get(entry.case_id)!;
    if (!cd.dateMap.has(entry.entry_date)) cd.dateMap.set(entry.entry_date, []);
    cd.dateMap.get(entry.entry_date)!.push(entry);
  }

  const caseOrderSet = new Set(caseOrder);
  const hasMore = allEntries.some((e) => !caseOrderSet.has(e.case_id));

  // Enrich with linked evidence + signed URLs
  const cappedEntries = allEntries.filter((e) => caseOrderSet.has(e.case_id));
  const entryIds = cappedEntries.map((e) => e.id);
  const enrichedMap = new Map<string, EntryFull>();
  cappedEntries.forEach((e) => enrichedMap.set(e.id, e));

  if (entryIds.length > 0) {
    const { data: evidenceRows } = await supabase
      .from("evidence")
      .select("id, case_id, type, category, storage_path, file_name, file_size, mime_type, notes, uploaded_by, uploaded_at, timeline_entry_id")
      .in("timeline_entry_id", entryIds);

    if (evidenceRows && evidenceRows.length > 0) {
      const paths = evidenceRows.map((e) => e.storage_path);
      const { data: signedData } = await supabase.storage
        .from(BUCKETS.evidence)
        .createSignedUrls(paths, 3600);

      const signedUrlMap: Record<string, string> = {};
      (signedData ?? []).forEach((su, i) => { signedUrlMap[paths[i]] = su.signedUrl ?? ""; });

      const evidenceByEntry = new Map<string, LinkedEvidence[]>();
      for (const ev of evidenceRows) {
        if (!ev.timeline_entry_id) continue;
        const list = evidenceByEntry.get(ev.timeline_entry_id) ?? [];
        list.push({
          id: ev.id, case_id: ev.case_id, type: ev.type, category: ev.category,
          storage_path: ev.storage_path, file_name: ev.file_name, file_size: ev.file_size,
          mime_type: ev.mime_type, notes: ev.notes, uploaded_by: ev.uploaded_by,
          uploaded_at: ev.uploaded_at, signedUrl: signedUrlMap[ev.storage_path] ?? "",
        });
        evidenceByEntry.set(ev.timeline_entry_id, list);
      }
      cappedEntries.forEach((e) => {
        enrichedMap.set(e.id, { ...e, linked_evidence: evidenceByEntry.get(e.id) ?? [] });
      });
    }
  }

  const caseGroups: CaseGroup[] = caseOrder.map((caseId) => {
    const { caseNumber, dateMap } = caseMap.get(caseId)!;
    return {
      caseId,
      caseNumber,
      dates: Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entries]) => ({
          date,
          entries: [...entries].reverse().map((e) => enrichedMap.get(e.id) ?? e),
        })),
    };
  });

  return { caseGroups, hasMore };
}
