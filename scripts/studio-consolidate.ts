/**
 * Consolidate near-duplicate imported knowledge / customer questions.
 *
 *   set -a; source .env.local; set +a
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/studio-consolidate.ts [knowledge|questions|all] [--dry-run] [--passes 2] [--model claude-sonnet-5] [--user <uuid>] [--category services,gps]
 *
 * Each pass re-reads only still-active rows (canonical + singletons), so a
 * second pass merges across batch boundaries.
 */
async function main() {
  const args = process.argv.slice(2);
  const target = (args.find((a) => !a.startsWith("--") && ["knowledge", "questions", "all"].includes(a)) ?? "all") as "knowledge" | "questions" | "all";
  const dryRun = args.includes("--dry-run");
  const val = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const model = val("--model");
  const userId = val("--user") ?? null;
  const passes = Math.max(1, Math.min(4, Number(val("--passes") ?? 2) || 2));
  const categories = val("--category")?.split(",").map((s) => s.trim()).filter(Boolean);
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[k]) {
      console.error(`missing env ${k} — run: set -a; source .env.local; set +a`);
      process.exit(1);
    }
  }
  if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("missing ANTHROPIC_API_KEY (use --dry-run to only count)");
    process.exit(1);
  }
  const { consolidateKnowledge, consolidateQuestions } = await import("../src/lib/studio/consolidate");
  console.log(`target=${target} passes=${passes} ${dryRun ? "DRY RUN" : `model=${model ?? "(studio setting)"}`}${categories?.length ? ` categories=${categories.join(",")}` : ""}`);
  const started = Date.now();
  for (let p = 1; p <= (dryRun ? 1 : passes); p++) {
    console.log(`\n=== pass ${p} ===`);
    if (target !== "questions") {
      const r = await consolidateKnowledge({ dryRun, model, userId, categories, onProgress: (m) => console.log(m) });
      console.log(`knowledge: scanned=${r.scanned} batches=${r.batches} groups=${r.groups} merged=${r.merged} dropped=${r.dropped} errors=${r.errors.length}`);
      for (const e of r.errors.slice(0, 10)) console.log(`  ! ${e}`);
      if (!dryRun && r.groups === 0) console.log("knowledge: nothing left to merge");
    }
    if (target !== "knowledge") {
      const r = await consolidateQuestions({ dryRun, model, userId, onProgress: (m) => console.log(m) });
      console.log(`questions: scanned=${r.scanned} batches=${r.batches} groups=${r.groups} merged=${r.merged} dropped=${r.dropped} errors=${r.errors.length}`);
      for (const e of r.errors.slice(0, 10)) console.log(`  ! ${e}`);
    }
  }
  console.log(`\nDONE in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
