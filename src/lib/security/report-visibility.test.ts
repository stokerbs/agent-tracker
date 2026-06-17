/**
 * R-4 — Report visibility workflow tests
 *
 * Verifies that is_client_visible can ONLY be set to true through the
 * approveReport action, never through draft saves, regeneration, or status
 * transitions.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const actionsPath = resolve(
  __dirname,
  "../../app/(dashboard)/reports/actions.ts",
);
const actionsSource = readFileSync(actionsPath, "utf-8");
const rlsSource = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/0003_rls_policies.sql"),
  "utf-8",
);

// ── Helper: extract a named exported function's source text ───────────────────

function extractFn(src: string, name: string): string {
  // Match both `function name(` and `async function name(`
  const patterns = [
    `export async function ${name}(`,
    `export function ${name}(`,
    `async function ${name}(`,
    `function ${name}(`,
  ];

  let fnStart = -1;
  for (const p of patterns) {
    const idx = src.indexOf(p);
    if (idx !== -1) { fnStart = idx; break; }
  }

  if (fnStart === -1) return "";

  // Walk forward to find the matching closing brace.
  let depth = 0;
  let inString = false;
  let strChar = "";
  let i = fnStart;
  while (i < src.length) {
    const ch = src[i];
    if (inString) {
      if (ch === strChar && src[i - 1] !== "\\") inString = false;
    } else {
      if (ch === '"' || ch === "'" || ch === "`") { inString = true; strChar = ch; }
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { i++; break; }
      }
    }
    i++;
  }
  return src.slice(fnStart, i);
}

// ── Tests: is_client_visible write gates ─────────────────────────────────────

describe("report visibility — is_client_visible write gates", () => {
  const restrictedFns = [
    "generateCaseReport",
    "regenerateReport",
    "saveReportDraft",
    "submitReportForReview",
    "archiveReport",
    "unarchiveReport",
    "deleteReport",
  ];

  for (const fn of restrictedFns) {
    it(`${fn}() does not set is_client_visible`, () => {
      const body = extractFn(actionsSource, fn);
      expect(body.length, `${fn} not found in actions.ts`).toBeGreaterThan(0);
      expect(body, `${fn}() must NOT contain is_client_visible`).not.toContain(
        "is_client_visible",
      );
    });
  }

  it("approveReport sets is_client_visible in its update payload", () => {
    const body = extractFn(actionsSource, "approveReport");
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain("is_client_visible");
    expect(body).toContain("approved");
  });
});

// ── Tests: insert defaults ────────────────────────────────────────────────────

describe("report visibility — insert defaults", () => {
  it("generateCaseReport inserts with status='draft' and no is_client_visible override", () => {
    const body = extractFn(actionsSource, "generateCaseReport");
    expect(body).toContain("draft");
    expect(body).not.toContain("is_client_visible");
  });

  it("regenerateReport updates to status='draft' without touching is_client_visible", () => {
    const body = extractFn(actionsSource, "regenerateReport");
    expect(body).toContain("draft");
    expect(body).not.toContain("is_client_visible");
  });
});

// ── Tests: RLS policy documentation assertions ────────────────────────────────

describe("report visibility — RLS 'reports client read' policy", () => {
  function findPolicy(src: string): string {
    const idx = src.indexOf("reports client read");
    if (idx === -1) return "";
    return src.slice(idx, idx + 600);
  }

  it("policy exists in migration 0003", () => {
    expect(rlsSource).toContain("reports client read");
  });

  it("requires status = 'approved'", () => {
    expect(findPolicy(rlsSource)).toContain("approved");
  });

  it("requires is_client_visible gate", () => {
    expect(findPolicy(rlsSource)).toContain("is_client_visible");
  });

  it("requires ownership chain: cases → clients → auth.uid()", () => {
    const policy = findPolicy(rlsSource);
    expect(policy).toContain("client_id");
    expect(policy).toContain("profile_id");
    expect(policy).toContain("auth.uid()");
  });
});
