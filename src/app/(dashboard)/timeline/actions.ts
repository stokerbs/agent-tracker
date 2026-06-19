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
