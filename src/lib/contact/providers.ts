/**
 * Phase-2 provider seam for Contact Intelligence.
 *
 * Email-breach lookup (e.g. Have I Been Pwned) and username discovery (e.g.
 * WhatsMyName-style checks) are external/paid or high-fan-out workloads deferred
 * to Phase 2. This module defines the adapter interfaces plus no-op defaults so
 * the pipeline can call them uniformly today and light them up later with zero
 * pipeline changes — mirroring src/lib/osint/inference.ts.
 */

export interface BreachHit {
  source: string;
  name: string;
  breachDate: string | null; // ISO date
  dataClasses: string[];
}

export interface AccountHit {
  platform: string;
  url: string | null;
  exists: boolean;
  confidence: number | null;
}

export interface BreachAdapter {
  readonly available: boolean;
  checkEmail(email: string): Promise<BreachHit[]>;
}

export interface UsernameAdapter {
  readonly available: boolean;
  checkUsername(username: string): Promise<AccountHit[]>;
}

export const noopBreachAdapter: BreachAdapter = {
  available: false,
  async checkEmail() {
    return [];
  },
};

export const noopUsernameAdapter: UsernameAdapter = {
  available: false,
  async checkUsername() {
    return [];
  },
};

/** Resolve the breach adapter (Phase 2 swaps for an HIBP-backed impl, env-gated). */
export function getBreachAdapter(): BreachAdapter {
  return noopBreachAdapter;
}

/** Resolve the username adapter (Phase 2 swaps for a real impl, env-gated). */
export function getUsernameAdapter(): UsernameAdapter {
  return noopUsernameAdapter;
}
