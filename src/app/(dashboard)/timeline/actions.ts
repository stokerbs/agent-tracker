"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff, requireRole } from "@/lib/auth";
import { handleDbError } from "@/lib/errors";

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
    photo_url: emptyToNull(formData.get("photo_url")),
    video_url: emptyToNull(formData.get("video_url")),
  };

  if (!payload.entry) return { error: "Entry text is required" };

  const { error } = await supabase.from("timeline_entries").insert(payload);
  if (error) return { error: handleDbError(error, "timeline") };

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/timeline");
  return { ok: true };
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
  const { error } = await supabase
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
    .is("deleted_at", null);

  if (error) return { error: handleDbError(error, "timeline") };

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/timeline");
  return { ok: true };
}

export async function deleteTimelineEntry(id: string, caseId: string) {
  const profile = await requireRole(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("timeline_entries")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { error: handleDbError(error, "timeline") };

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

  // Always look up the agent ID server-side for security
  let agentId: string | null = null;
  if (isStaff(profile.role)) {
    const { data: ag } = await supabase
      .from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
    agentId = ag?.id ?? null;
  } else {
    const { data: ag } = await supabase
      .from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
    agentId = ag?.id ?? null;
  }

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

  // Revalidate all affected case paths
  const caseIds = [...new Set(entries.map((e) => e.caseId))];
  for (const caseId of caseIds) {
    revalidatePath(`/cases/${caseId}`);
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

export async function generateReport(
  caseId: string,
  date: string,
  reportType: ReportType,
): Promise<{ report?: string; error?: string }> {
  const supabase = await createClient();

  const [entriesRes, caseRes] = await Promise.all([
    supabase
      .from("timeline_entries")
      .select("entry_time, entry, location")
      .eq("case_id", caseId)
      .eq("entry_date", date)
      .is("deleted_at", null)
      .order("entry_time", { ascending: true }),
    supabase.from("cases").select("case_number, client_name").eq("id", caseId).maybeSingle(),
  ]);

  const entries = entriesRes.data ?? [];
  const caseRow = caseRes.data;
  const caseNumber = caseRow?.case_number ?? caseId;

  const timelineText = entries.length
    ? entries
        .map((e) => `${e.entry_time.slice(0, 5)} — ${e.entry}${e.location ? ` [${e.location}]` : ""}`)
        .join("\n")
    : "(ไม่มีรายการบันทึก / No entries recorded)";

  if (!process.env.ANTHROPIC_API_KEY) {
    return { report: buildFallbackReport(reportType, caseNumber, date, entries) };
  }

  const thaiDate = formatThaiDate(date);

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
    const system = prompts[reportType];
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
      };
    }

    return { report: result.text.trim() };
  } catch (err) {
    return { report: buildFallbackReport(reportType, caseNumber, date, entries) };
  }
}
