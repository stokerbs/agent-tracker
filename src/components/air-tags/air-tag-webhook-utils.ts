/**
 * Pure client-side helpers for the AirTag webhook-token management UI
 * (webhook-tokens-panel.tsx, generate-webhook-token-dialog.tsx,
 * revoke-webhook-token-dialog.tsx). Mirrors air-tag-dialog-utils.ts's
 * convention of keeping presentation-only logic in a plain, directly
 * unit-testable .ts module (no JSX) — vitest.config.ts only collects
 * `src/**\/*.test.ts`.
 *
 * None of this is a security boundary: the server never returns the
 * plaintext token more than once (generateWebhookToken), never returns
 * token_hash (listWebhookTokens), and independently re-validates every
 * mutation (Golden Rule 1). This module only formats what the server has
 * already decided to show.
 */

// Mirrors generateTokenSchema's label max in air-tags/actions.ts — a UI-only
// hint (character counter, disabled state); the server re-validates.
export const WEBHOOK_TOKEN_LABEL_MAX = 120;

/** UX-only hint: true when a candidate label is within the server's max length. */
export function isWebhookTokenLabelValid(label: string): boolean {
  return label.trim().length <= WEBHOOK_TOKEN_LABEL_MAX;
}

/**
 * Mask a stored 8-char display prefix for the token list, e.g.
 * "abcd1234" -> "abcd1234••••••". The prefix itself is already safe to show
 * (it's not the secret — see actions.ts's TOKEN_PREFIX_LEN comment), the
 * trailing bullets are purely a visual cue that more characters existed.
 */
export function maskTokenPrefix(prefix: string): string {
  return `${prefix}••••••`;
}

export interface WebhookTokenLike {
  revoked_at: string | null;
}

/** True when a token has not been revoked. */
export function isTokenActive(token: WebhookTokenLike): boolean {
  return token.revoked_at === null;
}

/** Sorts tokens active-first, both groups newest-created-first (list already arrives newest-first from the server; this only re-groups). */
export function sortWebhookTokens<T extends WebhookTokenLike>(tokens: T[]): T[] {
  return [...tokens].sort((a, b) => {
    const aActive = isTokenActive(a) ? 0 : 1;
    const bActive = isTokenActive(b) ? 0 : 1;
    return aActive - bActive;
  });
}
