// Seeds a demo Field Agent account + a populated demo case for App Store / Play
// Store review (reviewers can't receive SMS OTP). Idempotent — safe to re-run.
//
//   node scripts/seed-demo-agent.mjs
//
// Reads SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL from .env.local.
// Demo phone via DEMO_PHONE env (default +66800000000). Pair this with a Supabase
// "test OTP" number (same value, fixed code) so the reviewer can sign in — see
// REVIEW.md. Uses only plaintext display columns, so no encryption keys are needed.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }

const PHONE = process.env.DEMO_PHONE || "+66800000000";
const AGENT_CODE = "DEMO01";
const CASE_NUMBER = "CASE-DEMO-0001";
const today = new Date().toISOString().slice(0, 10);

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function resolveProfileId() {
  // Idempotent shortcut: existing demo agent already points at the profile.
  const { data: existing } = await sb.from("agents").select("profile_id").eq("agent_code", AGENT_CODE).maybeSingle();
  if (existing?.profile_id) return existing.profile_id;

  const { data: created, error } = await sb.auth.admin.createUser({ phone: PHONE, phone_confirm: true });
  if (created?.user) return created.user.id;

  // Already registered — find the auth user by phone (stored without the leading +).
  const want = PHONE.replace(/^\+/, "");
  for (let page = 1; page <= 10; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const u = (data?.users ?? []).find((x) => (x.phone || "").replace(/^\+/, "") === want);
    if (u) return u.id;
    if (!data || data.users.length < 200) break;
  }
  throw new Error("Could not create or find the demo auth user: " + (error?.message ?? "unknown"));
}

async function main() {
  const profileId = await resolveProfileId();

  // Promote the auto-created profile (handle_new_user defaults to 'client') to agent.
  await sb.from("profiles").update({ role: "agent", full_name: "Demo Agent", is_active: true }).eq("id", profileId);

  // Linked agent row.
  let { data: agent } = await sb.from("agents").select("id").eq("agent_code", AGENT_CODE).maybeSingle();
  if (!agent) {
    const { data, error } = await sb
      .from("agents")
      .insert({ profile_id: profileId, agent_code: AGENT_CODE, full_name: "Demo Agent", status: "online", area: "Bangkok" })
      .select("id").single();
    if (error) throw error;
    agent = data;
  }

  // Demo case (+ sample content) so the field app isn't empty.
  let { data: demoCase } = await sb.from("cases").select("id").eq("case_number", CASE_NUMBER).maybeSingle();
  if (!demoCase) {
    const { data, error } = await sb
      .from("cases")
      .insert({
        case_number: CASE_NUMBER,
        client_name: "Demo Client",
        case_type: "Surveillance",
        status: "active",
        priority: "medium",
        description: "Sample case for App Store / Play Store review.",
        start_date: today,
      })
      .select("id").single();
    if (error) throw error;
    demoCase = data;

    await sb.from("timeline_entries").insert([
      { case_id: demoCase.id, agent_id: agent.id, entry_date: today, entry_time: "09:15:00", entry: "เป้าหมายเดินทางออกจากที่พักอาศัย", location: "Sukhumvit Soi 11" },
      { case_id: demoCase.id, agent_id: agent.id, entry_date: today, entry_time: "10:40:00", entry: "เป้าหมายเดินทางมาถึงร้าน Starbucks", location: "EmQuartier" },
      { case_id: demoCase.id, agent_id: agent.id, entry_date: today, entry_time: "13:05:00", entry: "เป้าหมายเดินทางกลับที่พักอาศัย", location: "Sukhumvit Soi 11" },
    ]);
    await sb.from("target_vehicles").insert({ case_id: demoCase.id, make: "Toyota", model: "Yaris", color: "White", is_primary: true });
    await sb.from("target_locations").insert({ case_id: demoCase.id, location_type: "home", location_name: "Sukhumvit Soi 11 Residence" });
  }

  // Assign the demo agent to the demo case (idempotent).
  await sb.from("case_agents").upsert({ case_id: demoCase.id, agent_id: agent.id }, { onConflict: "case_id,agent_id" });

  console.log("✓ Demo agent seeded.");
  console.log("  Login phone : " + PHONE);
  console.log("  Deep link   : /login?phone=" + encodeURIComponent(PHONE));
  console.log("  Configure the matching Supabase test-OTP number (see REVIEW.md) so the fixed code works.");
}

main().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
