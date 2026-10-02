/**
 * Case Lead ID shown to the client right after they submit a lead form, e.g.
 * `CN-261001-7K3Q` (Chinese intake), `TH-…` / `EN-…` (Thai / English site). Human-readable, unambiguous (no 0/O/1/I), and
 * carries the submission date so admins can sort by eye. Uniqueness is
 * enforced by the DB (marketing_leads.lead_ref unique); the API retries on a
 * collision, which at 4 symbols × 32 alphabet ≈ 1M/day is vanishingly rare.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export type LeadRefPrefix = "CN" | "TH" | "EN";

export function generateLeadRef(now: Date = new Date(), random: () => number = Math.random, prefix: LeadRefPrefix = "CN"): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  let tail = "";
  for (let i = 0; i < 4; i++) tail += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${prefix}-${yy}${mm}${dd}-${tail}`;
}

export const LEAD_REF_PATTERN = /^CN-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;
/** Any locale prefix (CN / TH / EN). */
export const ANY_LEAD_REF_PATTERN = /^(CN|TH|EN)-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;
