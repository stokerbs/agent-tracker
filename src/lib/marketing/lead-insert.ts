/**
 * Deploy-order safety for marketing lead inserts. Migrations 0127 (gclid,
 * fbclid, utm_content) and 0128 (channel) add columns the public lead routes
 * now write. If the app is deployed before those migrations run, PostgREST
 * rejects the insert with "column … does not exist" / schema-cache errors
 * and the contact form would 500. Instead we drop the optional columns and
 * insert again, logging loudly so the gap is visible. Pure helpers + one
 * retry wrapper; nothing here changes what a lead is, only which optional
 * attribution columns ride along.
 */
export const OPTIONAL_LEAD_COLUMNS = ["utm_content", "gclid", "fbclid", "channel"] as const;

export interface DbErrorLike { code?: string | null; message?: string | null }

/** Postgres 42703 (undefined column) or PostgREST PGRST204 (column missing from schema cache). */
export function isMissingColumnError(e: DbErrorLike | null | undefined): boolean {
  if (!e) return false;
  if (e.code === "42703" || e.code === "PGRST204") return true;
  const m = e.message ?? "";
  return /column .* does not exist|Could not find the '.*' column/i.test(m);
}

export function withoutOptionalColumns<T extends Record<string, unknown>>(row: T): Omit<T, (typeof OPTIONAL_LEAD_COLUMNS)[number]> {
  const copy: Record<string, unknown> = { ...row };
  for (const k of OPTIONAL_LEAD_COLUMNS) delete copy[k];
  return copy as Omit<T, (typeof OPTIONAL_LEAD_COLUMNS)[number]>;
}

/**
 * Run `exec(row)`; on a missing-column error retry once without the optional
 * attribution columns. Any other error (including 23505 lead_ref collisions,
 * which callers handle) is returned unchanged.
 */
export async function insertLeadResilient<R extends Record<string, unknown>, T extends { error: DbErrorLike | null }>(
  row: R,
  exec: (r: Record<string, unknown>) => PromiseLike<T>,
  context = "marketing:lead",
): Promise<T> {
  const first = await exec(row);
  if (!first.error || !isMissingColumnError(first.error)) return first;
  console.warn(`[${context}] lead insert failed on a column from migration 0127/0128 — retrying without optional attribution columns. Run the migrations.`, { code: first.error.code ?? null });
  return exec(withoutOptionalColumns(row));
}
