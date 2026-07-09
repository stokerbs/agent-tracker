/**
 * SSRF-safe outbound fetch for the OSINT module.
 *
 * The image analyzer downloads attacker-controlled URLs (image_url, and the
 * PimEyes-style redirect chains in redirect.ts). That is a textbook SSRF sink:
 * without guards a user could point us at cloud metadata (169.254.169.254),
 * internal services (10.0.0.0/8), or localhost. This module is the single
 * chokepoint through which every OSINT outbound request MUST pass.
 *
 * Defenses:
 *   • scheme allowlist (http/https only)
 *   • up-front DNS resolution + per-redirect-hop re-validation, with the
 *     resolved IP checked against a denylist of private / loopback / link-local
 *     / metadata / reserved ranges
 *   • connection-time IP validation via a custom undici `connect.lookup`: the
 *     SAME resolution used to open the socket is the one we validate, so a DNS
 *     rebinding race between "check" and "connect" cannot slip a private IP
 *     through (the up-front check alone is TOCTOU-vulnerable; this closes it)
 *   • redirect cap + manual redirect handling (fetch's own redirect follows
 *     would bypass per-hop IP checks)
 *   • hard timeout via AbortController
 *   • streamed body size cap (reject before buffering an unbounded response)
 */

import { lookup } from "node:dns/promises";
import net from "node:net";
import { fetch as undiciFetch, Agent } from "undici";
import type { LookupFunction } from "node:net";

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const DEFAULT_MAX_REDIRECTS = 10;

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

/**
 * True if `ip` (v4 or v6) falls in a range we must never connect to.
 * Covers loopback, private, link-local (incl. AWS/GCP metadata 169.254.169.254),
 * CGNAT, unspecified, ULA, and IPv4-mapped IPv6.
 */
export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // not a literal IP → treat as blocked (caller resolves first)
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 (test)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 198 && b === 51) return true; // 198.51.100/24 test
  if (a === 203 && b === 0) return true; // 203.0.113/24 test
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible → validate the v4 tail.
  const mapped = lower.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("::ffff:")) return true; // any other mapped form → block
  if (lower.startsWith("64:ff9b")) return true; // NAT64 → could reach private v4
  return false;
}

/**
 * undici `connect.lookup`: resolve the host, reject the connection if ANY
 * resolved address is blocked, otherwise hand back the first address. Because
 * this runs at socket-open time on the exact IP undici will connect to, it
 * closes the check-vs-connect (DNS rebinding) TOCTOU window that a plain
 * up-front check leaves open. Exported for unit testing.
 */
export const validatingLookup: LookupFunction = (hostname, _options, callback) => {
  lookup(hostname, { all: true })
    .then((records) => {
      if (records.length === 0) {
        callback(new SsrfError(`No DNS records: ${hostname}`), "", 0);
        return;
      }
      for (const r of records) {
        if (isBlockedIp(r.address)) {
          callback(new SsrfError(`Host ${hostname} resolves to blocked ${r.address}`), "", 0);
          return;
        }
      }
      callback(null, records[0].address, records[0].family);
    })
    .catch((err) => callback(err as NodeJS.ErrnoException, "", 0));
};

// One shared dispatcher for every guarded request. Its connect.lookup validates
// the real connection IP (see validatingLookup).
const ssrfAgent = new Agent({ connect: { lookup: validatingLookup } });

export interface GuardedResponse {
  finalUrl: string;
  status: number;
  headers: Headers;
  body: Buffer;
  /** Ordered hops actually followed (for redirect-chain forensics). */
  hops: { url: string; status: number; host: string; ip: string }[];
}

export interface GuardOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** HTTP method — GET to download, HEAD to probe. */
  method?: "GET" | "HEAD";
  /** Extra request headers (e.g. a UA). Host is always derived from the URL. */
  headers?: Record<string, string>;
}

/**
 * Validate a single URL: scheme + resolve host to an allowed IP.
 * Returns the resolved IP so the caller can pin the connection.
 * Throws SsrfError on any violation.
 */
export async function assertUrlAllowed(rawUrl: string): Promise<{ url: URL; ip: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Malformed URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(`Disallowed scheme: ${url.protocol}`);
  }
  // URL.hostname keeps the brackets for IPv6 literals ("[::1]") — strip them so
  // net.isIP recognizes the literal and we don't fall through to DNS.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A literal IP in the URL — validate directly, don't resolve.
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfError(`Blocked address: ${host}`);
    return { url, ip: host };
  }
  // Hostname → resolve ALL records; block if any resolved IP is disallowed
  // (a host that resolves to both a public and a private IP is still a threat).
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new SsrfError(`DNS resolution failed: ${host}`);
  }
  if (records.length === 0) throw new SsrfError(`No DNS records: ${host}`);
  for (const r of records) {
    if (isBlockedIp(r.address)) throw new SsrfError(`Host ${host} resolves to blocked ${r.address}`);
  }
  return { url, ip: records[0].address };
}

/**
 * SSRF-guarded fetch that follows redirects manually, re-validating every hop.
 * Returns the buffered body (size-capped) and the hop chain.
 */
export async function safeFetch(rawUrl: string, opts: GuardOptions = {}): Promise<GuardedResponse> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  const hops: GuardedResponse["hops"] = [];
  let current = rawUrl;

  for (let i = 0; i <= maxRedirects; i++) {
    const { url, ip } = await assertUrlAllowed(current);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = (await undiciFetch(url, {
        method: opts.method ?? "GET",
        redirect: "manual", // we follow manually to re-check each hop
        signal: controller.signal,
        dispatcher: ssrfAgent, // validates the real connection IP (anti-rebinding)
        headers: {
          "user-agent": "DetectivePulse-OSINT/1.0",
          accept: "*/*",
          ...opts.headers,
        },
      })) as unknown as Response;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof SsrfError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new SsrfError(`Request timed out after ${timeoutMs}ms: ${url.href}`);
      }
      // The blocked-IP error surfaces as the fetch's `cause`.
      const cause = (err as { cause?: unknown }).cause;
      if (cause instanceof SsrfError) throw cause;
      throw new SsrfError(`Fetch failed: ${(err as Error).message}`);
    }

    hops.push({ url: url.href, status: res.status, host: url.hostname, ip });

    // Redirect? Resolve Location against current URL and loop (re-validated).
    if (res.status >= 300 && res.status < 400 && res.headers.has("location")) {
      clearTimeout(timer);
      if (i === maxRedirects) throw new SsrfError(`Too many redirects (> ${maxRedirects})`);
      current = new URL(res.headers.get("location")!, url).href;
      // Drain to free the socket.
      await res.arrayBuffer().catch(() => undefined);
      continue;
    }

    // Terminal response — enforce Content-Length hint then stream with a cap.
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      clearTimeout(timer);
      throw new SsrfError(`Response too large: ${declared} > ${maxBytes}`);
    }

    const body = await readCapped(res, maxBytes).finally(() => clearTimeout(timer));
    return { finalUrl: url.href, status: res.status, headers: res.headers, body, hops };
  }

  throw new SsrfError(`Too many redirects (> ${maxRedirects})`);
}

/** Buffer a response body, aborting if it exceeds `maxBytes`. */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new SsrfError(`Response too large (> ${maxBytes})`);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new SsrfError(`Response exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
