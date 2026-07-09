import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DNS so hostname resolution is deterministic and offline.
const lookupMock = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...args: unknown[]) => lookupMock(...args) }));

import { isBlockedIp, assertUrlAllowed, validatingLookup, SsrfError } from "./fetch-guard";

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "0.0.0.0",
    "100.64.0.1", // CGNAT
    "224.0.0.1", // multicast
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1", // link-local
    "fc00::1", // ULA
    "fd12:3456::1", // ULA
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "::ffff:169.254.169.254", // IPv4-mapped metadata
  ])("blocks private/reserved %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34", // example.com
    "172.15.0.1", // just below private range
    "172.32.0.1", // just above private range
    "2606:4700:4700::1111", // Cloudflare v6
  ])("allows public %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });

  it("blocks non-IP input", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
  });
});

describe("assertUrlAllowed", () => {
  // Use mockClear (call history only), not mockReset: resetting an implementation
  // that throws synchronously trips a vitest v4 error-surfacing quirk. Each test
  // sets its own implementation below, so clearing history is sufficient.
  beforeEach(() => lookupMock.mockClear());

  it("rejects non-http(s) schemes", async () => {
    await expect(assertUrlAllowed("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed("ftp://example.com/x")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed("gopher://example.com")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects malformed URLs", async () => {
    await expect(assertUrlAllowed("http://")).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks literal metadata IP without a DNS lookup", async () => {
    await expect(assertUrlAllowed("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      /Blocked address/,
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("blocks literal loopback and localhost forms", async () => {
    await expect(assertUrlAllowed("http://127.0.0.1:8080/")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed("http://[::1]/")).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks a hostname that resolves to a private IP (DNS rebinding)", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    await expect(assertUrlAllowed("http://evil.example.com/")).rejects.toThrow(/blocked/i);
  });

  it("blocks when ANY resolved record is private", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.0.9", family: 4 },
    ]);
    await expect(assertUrlAllowed("http://mixed.example.com/")).rejects.toThrow(/blocked/i);
  });

  it("allows a public host and returns the resolved IP", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const { url, ip } = await assertUrlAllowed("https://example.com/pic.jpg");
    expect(url.hostname).toBe("example.com");
    expect(ip).toBe("93.184.216.34");
  });

  it("throws when DNS resolution fails", async () => {
    // Reset first to drop any prior resolved implementation, then use a
    // one-shot rejecting impl (persistent throwing impls trip a vitest v4 quirk).
    lookupMock.mockReset();
    lookupMock.mockImplementationOnce(() => Promise.reject(new Error("ENOTFOUND")));
    let caught: unknown;
    try {
      await assertUrlAllowed("http://nope.invalid/");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SsrfError);
    expect((caught as Error).message).toMatch(/DNS resolution failed/);
  });

  it("throws when there are no DNS records", async () => {
    lookupMock.mockResolvedValue([]);
    await expect(assertUrlAllowed("http://empty.example.com/")).rejects.toThrow(/No DNS records/);
  });
});

describe("validatingLookup (connection-time SSRF guard)", () => {
  beforeEach(() => lookupMock.mockClear());

  const run = (host: string): Promise<{ err: Error | null; address: string; family: number }> =>
    new Promise((resolve) => {
      validatingLookup(host, {}, (err, address, family) =>
        resolve({ err: err as Error | null, address: address as string, family: family as number }),
      );
    });

  it("passes a public IP through to the socket", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const r = await run("example.com");
    expect(r.err).toBeNull();
    expect(r.address).toBe("93.184.216.34");
  });

  it("blocks a connection that resolves to a private IP", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    const r = await run("rebind.example.com");
    expect(r.err).toBeInstanceOf(SsrfError);
    expect(r.address).toBe("");
  });

  it("blocks when ANY resolved record is private", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ]);
    const r = await run("mixed.example.com");
    expect(r.err).toBeInstanceOf(SsrfError);
  });

  it("errors when there are no records", async () => {
    lookupMock.mockResolvedValue([]);
    const r = await run("empty.example.com");
    expect(r.err).toBeInstanceOf(SsrfError);
  });
});
