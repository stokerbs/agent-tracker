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

async function callAnthropic(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
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
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
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

function parseWithRegex(rawText: string, defaultDate: string): ParsedEntry[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries: ParsedEntry[] = [];
  let current: { time: string; date: string; lines: string[] } | null = null;
  const TIME_START = /^(\d{1,2})[.:h\-](\d{2})\b/;
  for (const line of lines) {
    const m = line.match(TIME_START);
    if (m) {
      if (current) {
        entries.push({ time: current.time, date: current.date, entry: current.lines.join(" ") });
      }
      const h = m[1].padStart(2, "0");
      const min = m[2];
      const rest = line.slice(m[0].length).trim();
      current = { time: `${h}:${min}`, date: defaultDate, lines: rest ? [rest] : [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      // No time marker found yet — treat whole block as single entry
      const now = new Date();
      const t = now.toTimeString().slice(0, 5);
      entries.push({ time: t, date: defaultDate, entry: rawText });
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
  return entries;
}

export async function parseMultipleEntries(
  rawText: string,
  defaultDate: string,
): Promise<{ entries?: ParsedEntry[]; error?: string }> {
  const trimmed = rawText.trim().slice(0, 5000);
  if (!trimmed) return { error: "Entry text is required" };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { entries: parseWithRegex(trimmed, defaultDate) };
  }

  const system = `You are a surveillance timeline parser. The user may submit ONE or MULTIPLE timestamped events in a single block of text.

Your job:
1. Detect all time markers in the text. Time formats to recognize:
   - HH.MM (e.g. 10.15, 13.45)
   - HH:MM (e.g. 10:15, 13:45)
   - HHMM  (e.g. 1015, 1345, but only if it forms a valid 24h time)
   - HH-MM (e.g. 10-15)
2. Split the text at each time marker boundary.
3. For each segment, produce one structured entry.
4. Rewrite descriptions as professional surveillance English.
5. Translate Thai to English.
6. Start each description with "The subject" or an action verb.

Return ONLY a JSON array (no markdown, no explanation):
[
  {"time": "HH:MM", "date": "YYYY-MM-DD", "entry": "Professional description"},
  {"time": "HH:MM", "date": "YYYY-MM-DD", "entry": "Professional description"}
]

Rules:
- date: use defaultDate unless a different date is explicitly stated. defaultDate is ${defaultDate}.
- time: always 24h HH:MM format.
- If only one event is found, still return a single-element array.
- Sort entries by time ascending.`;

  try {
    const text = await callAnthropic(system, `Field notes:\n${trimmed}`, 1000);
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No array in response");
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty array");
    const entries: ParsedEntry[] = parsed.map((p: { time?: string; date?: string; entry?: string }) => ({
      time: String(p.time ?? "").trim() || new Date().toTimeString().slice(0, 5),
      date: String(p.date ?? "").trim() || defaultDate,
      entry: String(p.entry ?? "").trim() || trimmed,
    }));
    return { entries };
  } catch {
    // Fallback: return regex parse
    return { entries: parseWithRegex(trimmed, defaultDate) };
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
  } catch {
    return { error: "AI improvement failed" };
  }
}

export async function generateDailySummary(
  caseId: string,
  date: string,
  format: "internal" | "client" = "internal",
): Promise<{ summary?: string; error?: string }> {
  const supabase = await createClient();

  const [entriesRes, caseRes] = await Promise.all([
    supabase
      .from("timeline_entries")
      .select("entry_time, entry, location")
      .eq("case_id", caseId)
      .eq("entry_date", date)
      .is("deleted_at", null)
      .order("entry_time", { ascending: true }),
    supabase.from("cases").select("case_number").eq("id", caseId).maybeSingle(),
  ]);

  const entries = entriesRes.data ?? [];
  const caseRow = caseRes.data;

  const entriesText = entries
    .map(
      (e) =>
        `${e.entry_time.slice(0, 5)} — ${e.entry}${e.location ? ` [${e.location}]` : ""}`,
    )
    .join("\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    const header = `DAILY SURVEILLANCE REPORT — ${caseRow?.case_number ?? caseId} — ${date}`;
    const body = entries.length
      ? entriesText
      : "No entries recorded for this date.";
    return { summary: `${header}\n\n${body}` };
  }

  try {
    const system =
      format === "client"
        ? "Write a professional daily surveillance report for a client.\n" +
          "Format:\n" +
          "- Header: \"DAILY SURVEILLANCE REPORT\"\n" +
          "- Case number and date\n" +
          "- Professional narrative (no jargon, suitable for client presentation)\n" +
          "- Third person, past tense, English only\n" +
          "- Factual, concise\n" +
          "Return the full formatted report as plain text."
        : "Write a professional daily surveillance summary. Format: Header 'DAILY SURVEILLANCE REPORT — [Case] — [Date]', brief executive summary (2-3 sentences), chronological narrative in professional surveillance language, closing observation. English only. Third person. Past tense. Factual.";
    const user = `Case: ${caseRow?.case_number}\nDate: ${date}\n\nTimeline:\n${entriesText}`;
    const summary = await callAnthropic(system, user, 800);
    return { summary: summary.trim() };
  } catch {
    return { error: "Failed to generate summary" };
  }
}
