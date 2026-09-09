/**
 * Offline bulk import of LINE OA chat-history CSV exports into the Creative
 * Studio knowledge base.
 *
 *   set -a; source .env.local; set +a
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/studio-import-line-history.ts <dir-or-files…> [--dry-run] [--model claude-sonnet-5] [--user <profile uuid>]
 *
 * Reads every *.csv (also inside *.zip is NOT supported — unzip first), never
 * uploads raw text anywhere except the redacted AI window, writes a JSON report
 * next to the inputs. Idempotent per file+window.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
  const userIdx = args.indexOf("--user");
  const userId = userIdx >= 0 ? args[userIdx + 1] : null;
  const concIdx = args.indexOf("--concurrency");
  const concurrency = Math.max(1, Math.min(8, concIdx >= 0 ? Number(args[concIdx + 1]) || 1 : 3));
  const minIdx = args.indexOf("--min-user-messages");
  const minUserMessages = minIdx >= 0 ? Number(args[minIdx + 1]) || 2 : 2;
  const VALUE_FLAGS = new Set(["--model", "--user", "--concurrency", "--min-user-messages"]);
  const paths = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1] ?? ""));
  if (!paths.length) {
    console.error("usage: studio-import-line-history.ts <dir-or-files…> [--dry-run] [--model <id>] [--user <uuid>] [--concurrency 1-8] [--min-user-messages N]");
    process.exit(1);
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BIDX_KEY"]) {
    if (!process.env[k]) {
      console.error(`missing env ${k} — run: set -a; source .env.local; set +a`);
      process.exit(1);
    }
  }
  if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("missing ANTHROPIC_API_KEY (use --dry-run to only parse)");
    process.exit(1);
  }

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (f.name.startsWith("._") || f.name === "__MACOSX") continue;
      const full = join(dir, f.name);
      if (f.isDirectory()) walk(full);
      else if (f.name.toLowerCase().endsWith(".csv")) files.push(full);
    }
  };
  for (const p of paths) {
    const abs = resolve(p);
    if (statSync(abs).isDirectory()) walk(abs);
    else files.push(abs);
  }
  files.sort();
  console.log(`${files.length} file(s) · ${dryRun ? "DRY RUN (parse + window only, no AI, no writes)" : `model=${model ?? "(studio setting)"} concurrency=${concurrency}`} · minUserMessages=${minUserMessages}`);

  const { importLineHistoryFile } = await import("../src/lib/studio/import/line-history");
  type FileResult = Awaited<ReturnType<typeof importLineHistoryFile>>;
  const results: FileResult[] = [];
  const started = Date.now();
  let next = 0;
  let skippedTiny = 0;
  const quiet = files.length > 50; // per-window progress is noise at this scale
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      const f = files[i];
      const content = readFileSync(f, "utf8");
      const r = await importLineHistoryFile(basename(f), content, { dryRun, model, userId, minUserMessages, onProgress: quiet ? undefined : (m) => console.log(m) });
      results[i] = r;
      if (r.errors.length === 1 && r.errors[0].startsWith("skipped:")) {
        skippedTiny += 1;
        continue;
      }
      console.log(
        `[${i + 1}/${files.length}] msgs=${r.messages} windows=${r.windows} skipped=${r.windowsSkipped} knowledge=+${r.knowledgeInserted} caseLessons=+${r.caseLessonsInserted} facts=+${r.serviceFactsInserted} questions=+${r.questionsInserted}/~${r.questionsMerged} dropped=${r.dropped}${r.errors.length ? ` errors=${r.errors.length}` : ""}`,
      );
      for (const e of r.errors) console.log(`  ! ${e}`);
    }
  };
  await Promise.all(Array.from({ length: dryRun ? 1 : concurrency }, worker));
  console.log(`\nskipped ${skippedTiny} chat(s) with < ${minUserMessages} customer messages`);
  const sum = (k: keyof FileResult) => results.reduce((n, r) => n + (Array.isArray(r[k]) ? r[k].length : Number(r[k]) || 0), 0);
  console.log(
    `\nDONE in ${((Date.now() - started) / 1000).toFixed(0)}s · files=${results.length} windows=${sum("windows")} (skipped ${sum("windowsSkipped")}) knowledge=+${sum("knowledgeInserted")} caseLessons=+${sum("caseLessonsInserted")} facts=+${sum("serviceFactsInserted")} questions=+${sum("questionsInserted")}/~${sum("questionsMerged")} dropped=${sum("dropped")} errors=${sum("errors")}`,
  );
  // Report lives next to the inputs (never inside the repo).
  const reportDir = statSync(resolve(paths[0])).isDirectory() ? resolve(paths[0]) : resolve(paths[0], "..");
  const report = join(reportDir, `line-import-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
  writeFileSync(report, JSON.stringify({ dryRun, model: model ?? null, results }, null, 2));
  console.log(`report: ${report}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
