/**
 * Bulk-approve consolidated knowledge for AI content use.
 *
 *   set -a; source .env.local; set +a
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/studio-approve-knowledge.ts [--dry-run] [--user <uuid>] [--limit N] [--category a,b]
 *
 * Only canonical rows (tag `consolidated`) that are still active, unapproved,
 * not `restricted`, carry no review flag, and pass a FRESH deterministic scrub
 * with no high/medium finding are approved. Everything else is listed and left
 * for the owner — this never lowers the privacy bar, it only applies it again.
 */
const REVIEW_TAGS = ["ต้องตรวจ privacy", "ต้องยืนยัน"];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const val = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const userId = val("--user") ?? null;
  const limit = Math.max(1, Math.min(5000, Number(val("--limit") ?? 5000) || 5000));
  const categories = val("--category")?.split(",").map((s) => s.trim()).filter(Boolean);
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[k]) {
      console.error(`missing env ${k} — run: set -a; source .env.local; set +a`);
      process.exit(1);
    }
  }
  const { createServiceClient } = await import("../src/lib/supabase/server");
  const { scrubText } = await import("../src/lib/studio/privacy/scrub");
  const { getStudioSettingsStrict } = await import("../src/lib/studio/settings");
  const svc = createServiceClient();
  const rules = (await getStudioSettingsStrict()).privacy_rules;

  const rows: { id: string; title: string; content: string; category: string; tags: string[]; sensitivity: string; member_count: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc
      .from("studio_knowledge_sources")
      .select("id, title, content, category, tags, sensitivity, member_count")
      .contains("tags", ["consolidated"])
      .is("superseded_by", null)
      .eq("approved_for_content", false)
      .neq("sensitivity", "restricted")
      .order("member_count", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`load: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const scoped = rows.filter((r) => !categories?.length || categories.includes(r.category));
  const flagged = scoped.filter((r) => (r.tags ?? []).some((t) => REVIEW_TAGS.includes(t)));
  const candidates = scoped.filter((r) => !(r.tags ?? []).some((t) => REVIEW_TAGS.includes(t)));

  const clean: typeof candidates = [];
  const dirty: { row: (typeof candidates)[number]; reason: string }[] = [];
  for (const r of candidates) {
    const findings = scrubText({ fields: { title: r.title, content: r.content }, rules });
    const hit = findings.find((f) => f.severity === "high" || f.severity === "medium" || f.kind === "denylist");
    if (hit) dirty.push({ row: r, reason: `${hit.kind}/${hit.severity}` });
    else clean.push(r);
  }

  const byCat = new Map<string, number>();
  for (const r of clean) byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
  console.log(`canonical rows unapproved: ${scoped.length}`);
  console.log(`  flagged for review (skipped): ${flagged.length}`);
  console.log(`  fresh scan found identifiers (skipped): ${dirty.length}`);
  console.log(`  clean → approve: ${clean.length}${clean.length > limit ? ` (limited to ${limit})` : ""}`);
  for (const [c, n] of Array.from(byCat).sort((a, b) => b[1] - a[1])) console.log(`    ${c}: ${n}`);
  const reasons = new Map<string, number>();
  for (const d of dirty) reasons.set(d.reason, (reasons.get(d.reason) ?? 0) + 1);
  if (reasons.size) console.log(`  skip reasons: ${Array.from(reasons).map(([k, v]) => `${k}×${v}`).join(", ")}`);

  const toApprove = clean.slice(0, limit);
  if (dryRun || !toApprove.length) {
    console.log(dryRun ? "\nDRY RUN — nothing written" : "\nnothing to approve");
    return;
  }
  let done = 0;
  for (let i = 0; i < toApprove.length; i += 200) {
    const ids = toApprove.slice(i, i + 200).map((r) => r.id);
    const { error } = await svc.from("studio_knowledge_sources").update({ approved_for_content: true }).in("id", ids);
    if (error) throw new Error(`approve: ${error.message}`);
    done += ids.length;
    console.log(`  approved ${done}/${toApprove.length}`);
  }
  const { logAudit } = await import("../src/lib/audit");
  await logAudit({ actorId: userId, action: "STUDIO_KNOWLEDGE_APPROVE", entity: "studio_knowledge_sources", metadata: { bulk: true, approved: done, skipped_flagged: flagged.length, skipped_findings: dirty.length, source: "consolidated" } });
  console.log(`\nDONE approved=${done}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
