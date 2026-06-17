/** Pure string utilities for reading/stripping the embedded provider tag.
 *  No server-only imports — safe for client bundles.
 */

export type ReportSource = "claude" | "template";

const PROVIDER_TAG_RE = /\n__PROVIDER:(claude|template)__$/;

export function stripProviderTag(body: string): string {
  return body.replace(PROVIDER_TAG_RE, "");
}

export function readProviderTag(body: string | null): ReportSource | null {
  if (!body) return null;
  const m = body.match(PROVIDER_TAG_RE);
  return m ? (m[1] as ReportSource) : null;
}
