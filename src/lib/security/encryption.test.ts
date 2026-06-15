import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted runs before static imports, so env vars are present when the
// module first initialises and caches its keys.
const { TEST_ENC_KEY, TEST_BIDX_KEY } = vi.hoisted(() => {
  const TEST_ENC_KEY  = "a".repeat(64); // 32 bytes of 0xaa
  const TEST_BIDX_KEY = "b".repeat(64); // 32 bytes of 0xbb
  process.env.ENCRYPTION_KEY = TEST_ENC_KEY;
  process.env.BIDX_KEY       = TEST_BIDX_KEY;
  return { TEST_ENC_KEY, TEST_BIDX_KEY };
});

import {
  createLicensePlateBlindIndex,
  createNameBlindIndex,
  createPhoneBlindIndex,
  decryptField,
  encryptField,
} from "./encryption";

// Flip one byte at the given offset inside the base64-encoded blob.
function tamper(encrypted: string, byteOffset: number): string {
  const buf = Buffer.from(encrypted, "base64");
  buf[byteOffset] ^= 0x01;
  return buf.toString("base64");
}

// ─── round-trip ───────────────────────────────────────────────────────────────

describe("round-trip encryption", () => {
  it("decrypts to the original ASCII string", () => {
    const v = "John Doe";
    expect(decryptField(encryptField(v))).toBe(v);
  });

  it("round-trips an empty string", () => {
    expect(decryptField(encryptField(""))).toBe("");
  });

  it("round-trips a 10 000-character string", () => {
    const v = "x".repeat(10_000);
    expect(decryptField(encryptField(v))).toBe(v);
  });

  it("round-trips Unicode, accented characters, and emoji", () => {
    const v = "François Müller — 北京 🔐";
    expect(decryptField(encryptField(v))).toBe(v);
  });

  it("round-trips a street address with punctuation", () => {
    const v = "123 Main St, Apt #4B, New York, NY 10001";
    expect(decryptField(encryptField(v))).toBe(v);
  });

  it("round-trips a phone number", () => {
    const v = "+1 (555) 867-5309";
    expect(decryptField(encryptField(v))).toBe(v);
  });

  it("round-trips a vehicle description", () => {
    const v = "2019 Toyota Camry — Silver — XSE";
    expect(decryptField(encryptField(v))).toBe(v);
  });
});

// ─── random nonce ─────────────────────────────────────────────────────────────

describe("random nonce behaviour", () => {
  it("produces a different ciphertext on every call for the same input", () => {
    const v = "same plaintext";
    const a = encryptField(v);
    const b = encryptField(v);
    expect(a).not.toBe(b);
  });

  it("both ciphertexts still decrypt to the original value", () => {
    const v = "same plaintext";
    expect(decryptField(encryptField(v))).toBe(v);
    expect(decryptField(encryptField(v))).toBe(v);
  });

  it("the nonce portion (bytes 1-12) differs between two encryptions", () => {
    const a = Buffer.from(encryptField("x"), "base64");
    const b = Buffer.from(encryptField("x"), "base64");
    expect(a.subarray(1, 13)).not.toEqual(b.subarray(1, 13));
  });

  it("encrypts 100 times and every output is unique", () => {
    const outputs = new Set(Array.from({ length: 100 }, () => encryptField("test")));
    expect(outputs.size).toBe(100);
  });
});

// ─── wire format ──────────────────────────────────────────────────────────────

describe("wire format", () => {
  it("the decoded blob starts with version byte 0x01", () => {
    const buf = Buffer.from(encryptField("test"), "base64");
    expect(buf[0]).toBe(0x01);
  });

  it("blob length is version(1) + nonce(12) + utf8_bytes + tag(16)", () => {
    // "hi" is 2 UTF-8 bytes; AES-GCM produces ciphertext of equal length
    const buf = Buffer.from(encryptField("hi"), "base64");
    expect(buf.length).toBe(1 + 12 + 2 + 16);
  });

  it("blob length for empty string is 29 bytes (minimum)", () => {
    const buf = Buffer.from(encryptField(""), "base64");
    expect(buf.length).toBe(29);
  });

  it("output is valid base64 (round-trip lossless)", () => {
    const enc = encryptField("test");
    expect(Buffer.from(enc, "base64").toString("base64")).toBe(enc);
  });
});

// ─── tamper detection ─────────────────────────────────────────────────────────

describe("tamper detection", () => {
  it("throws when a ciphertext byte is flipped (byte 13 = first body byte)", () => {
    // layout: version(0) nonce(1-12) body(13…) tag(last 16)
    expect(() => decryptField(tamper(encryptField("sensitive data"), 13))).toThrow();
  });

  it("throws when the last auth-tag byte is modified", () => {
    const enc = encryptField("sensitive data");
    const len = Buffer.from(enc, "base64").length;
    expect(() => decryptField(tamper(enc, len - 1))).toThrow();
  });

  it("throws when the first auth-tag byte is modified", () => {
    const enc = encryptField("sensitive data");
    const len = Buffer.from(enc, "base64").length;
    expect(() => decryptField(tamper(enc, len - 16))).toThrow();
  });

  it("throws when the nonce is modified (first nonce byte = byte 1)", () => {
    expect(() => decryptField(tamper(encryptField("sensitive data"), 1))).toThrow();
  });

  it("throws when the nonce is modified (last nonce byte = byte 12)", () => {
    expect(() => decryptField(tamper(encryptField("sensitive data"), 12))).toThrow();
  });

  it("throws with a /version/ message when the version byte is changed", () => {
    // 0x01 XOR 0x01 = 0x00 — version byte becomes 0x00
    expect(() => decryptField(tamper(encryptField("test"), 0))).toThrow(/version/i);
  });

  it("throws on a blob that is too short", () => {
    const shortBlob = Buffer.alloc(10).toString("base64");
    expect(() => decryptField(shortBlob)).toThrow(/too short/i);
  });

  it("throws on an empty string", () => {
    expect(() => decryptField("")).toThrow();
  });

  it("throws on arbitrary base64 garbage", () => {
    expect(() => decryptField(Buffer.alloc(100, 0xff).toString("base64"))).toThrow();
  });
});

// ─── createNameBlindIndex ─────────────────────────────────────────────────────

describe("createNameBlindIndex", () => {
  it("returns a 64-character lowercase hex string", () => {
    expect(createNameBlindIndex("John Doe")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(createNameBlindIndex("John Doe")).toBe(createNameBlindIndex("John Doe"));
  });

  it("normalises uppercase to lowercase", () => {
    expect(createNameBlindIndex("JOHN DOE")).toBe(createNameBlindIndex("john doe"));
  });

  it("normalises mixed case", () => {
    expect(createNameBlindIndex("JoHn DoE")).toBe(createNameBlindIndex("john doe"));
  });

  it("trims leading whitespace", () => {
    expect(createNameBlindIndex("   john doe")).toBe(createNameBlindIndex("john doe"));
  });

  it("trims trailing whitespace", () => {
    expect(createNameBlindIndex("john doe   ")).toBe(createNameBlindIndex("john doe"));
  });

  it("collapses multiple interior spaces", () => {
    expect(createNameBlindIndex("john  doe")).toBe(createNameBlindIndex("john doe"));
    expect(createNameBlindIndex("john   doe")).toBe(createNameBlindIndex("john doe"));
  });

  it("collapses tabs and newlines as whitespace", () => {
    expect(createNameBlindIndex("john\tdoe")).toBe(createNameBlindIndex("john doe"));
    expect(createNameBlindIndex("john\ndoe")).toBe(createNameBlindIndex("john doe"));
  });

  it("combined normalisation: trim + collapse + lowercase", () => {
    expect(createNameBlindIndex("  JOHN  DOE  ")).toBe(createNameBlindIndex("john doe"));
  });

  it("handles an empty string", () => {
    expect(createNameBlindIndex("")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different indexes for different names", () => {
    expect(createNameBlindIndex("John Doe")).not.toBe(createNameBlindIndex("Jane Doe"));
    expect(createNameBlindIndex("Alice")).not.toBe(createNameBlindIndex("Bob"));
  });
});

// ─── createPhoneBlindIndex ────────────────────────────────────────────────────

describe("createPhoneBlindIndex", () => {
  it("returns a 64-character lowercase hex string", () => {
    expect(createPhoneBlindIndex("0812345678")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(createPhoneBlindIndex("0812345678")).toBe(createPhoneBlindIndex("0812345678"));
  });

  it("strips dashes: 081-234-5678 ≡ 0812345678", () => {
    expect(createPhoneBlindIndex("081-234-5678")).toBe(createPhoneBlindIndex("0812345678"));
  });

  it("strips spaces: 081 234 5678 ≡ 0812345678", () => {
    expect(createPhoneBlindIndex("081 234 5678")).toBe(createPhoneBlindIndex("0812345678"));
  });

  it("strips parentheses: (081)2345678 ≡ 0812345678", () => {
    expect(createPhoneBlindIndex("(081)2345678")).toBe(createPhoneBlindIndex("0812345678"));
  });

  it("strips plus sign and country code punctuation", () => {
    expect(createPhoneBlindIndex("+1 (555) 867-5309")).toBe(createPhoneBlindIndex("15558675309"));
  });

  it("all three formats from the spec produce the same index", () => {
    const a = createPhoneBlindIndex("081-234-5678");
    const b = createPhoneBlindIndex("081 234 5678");
    const c = createPhoneBlindIndex("(081)2345678");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("handles an empty string", () => {
    expect(createPhoneBlindIndex("")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different indexes for different numbers", () => {
    expect(createPhoneBlindIndex("0812345678")).not.toBe(createPhoneBlindIndex("0812345679"));
  });
});

// ─── createLicensePlateBlindIndex ─────────────────────────────────────────────

describe("createLicensePlateBlindIndex", () => {
  it("returns a 64-character lowercase hex string", () => {
    expect(createLicensePlateBlindIndex("ABC1234")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(createLicensePlateBlindIndex("ABC1234")).toBe(createLicensePlateBlindIndex("ABC1234"));
  });

  it("uppercases lowercase input", () => {
    expect(createLicensePlateBlindIndex("abc1234")).toBe(createLicensePlateBlindIndex("ABC1234"));
  });

  it("strips spaces: 'ABC 1234' ≡ 'ABC1234'", () => {
    expect(createLicensePlateBlindIndex("ABC 1234")).toBe(createLicensePlateBlindIndex("ABC1234"));
  });

  it("strips dashes: 'ABC-1234' ≡ 'ABC1234'", () => {
    expect(createLicensePlateBlindIndex("ABC-1234")).toBe(createLicensePlateBlindIndex("ABC1234"));
  });

  it("all three spec formats produce the same index (Thai plate)", () => {
    const a = createLicensePlateBlindIndex("1กข-1234");
    const b = createLicensePlateBlindIndex("1กข1234");
    const c = createLicensePlateBlindIndex("1กข 1234");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("normalisation is case + strip combined", () => {
    expect(createLicensePlateBlindIndex("abc - 1234")).toBe(
      createLicensePlateBlindIndex("ABC1234"),
    );
  });

  it("handles an empty string", () => {
    expect(createLicensePlateBlindIndex("")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different indexes for different plates", () => {
    expect(createLicensePlateBlindIndex("ABC1234")).not.toBe(
      createLicensePlateBlindIndex("ABC1235"),
    );
  });
});

// ─── cross-field key separation ───────────────────────────────────────────────

describe("cross-field key separation", () => {
  it("name index differs from ciphertext of same value", () => {
    const encrypted = encryptField("test value");
    const index     = createNameBlindIndex("test value");
    expect(encrypted).not.toBe(index);
    // blind index is stable; ciphertext is not
    expect(createNameBlindIndex("test value")).toBe(index);
    expect(encryptField("test value")).not.toBe(encrypted);
  });

  it("phone and name indexes differ for the same raw string", () => {
    // normalizations diverge: name lowercases, phone strips non-digits
    expect(createPhoneBlindIndex("ABC")).not.toBe(createNameBlindIndex("ABC"));
  });

  it("plate and name indexes differ for the same raw string", () => {
    // plate uppercases, name lowercases — different normalised forms → different index
    expect(createLicensePlateBlindIndex("abc")).not.toBe(createNameBlindIndex("abc"));
  });

  it("all three functions produce distinct indexes for the same raw input", () => {
    const raw = "test123";
    const indexes = [
      createNameBlindIndex(raw),
      createPhoneBlindIndex(raw),
      createLicensePlateBlindIndex(raw),
    ];
    expect(new Set(indexes).size).toBe(3);
  });
});

// ─── startup validation ───────────────────────────────────────────────────────

describe("startup validation", () => {
  // Each test resets the module cache so a fresh _keys = null is triggered.
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws a descriptive error when ENCRYPTION_KEY is absent", async () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    const { encryptField: fn } = await import("./encryption");
    expect(() => fn("test")).toThrow("ENCRYPTION_KEY");
    process.env.ENCRYPTION_KEY = saved;
  });

  it("throws when ENCRYPTION_KEY is only 32 characters (not 64)", async () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "a".repeat(32);
    const { encryptField: fn } = await import("./encryption");
    expect(() => fn("test")).toThrow("ENCRYPTION_KEY");
    process.env.ENCRYPTION_KEY = saved;
  });

  it("throws when ENCRYPTION_KEY is 65 characters (one too many)", async () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "a".repeat(65);
    const { encryptField: fn } = await import("./encryption");
    expect(() => fn("test")).toThrow("ENCRYPTION_KEY");
    process.env.ENCRYPTION_KEY = saved;
  });

  it("throws when ENCRYPTION_KEY contains non-hex characters", async () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "z".repeat(64); // 'z' is not hex
    const { encryptField: fn } = await import("./encryption");
    expect(() => fn("test")).toThrow("ENCRYPTION_KEY");
    process.env.ENCRYPTION_KEY = saved;
  });

  it("throws a descriptive error when BIDX_KEY is absent", async () => {
    const saved = process.env.BIDX_KEY;
    delete process.env.BIDX_KEY;
    const { createNameBlindIndex: fn } = await import("./encryption");
    expect(() => fn("test")).toThrow("BIDX_KEY");
    process.env.BIDX_KEY = saved;
  });

  it("throws when BIDX_KEY is 63 characters (one too short)", async () => {
    const saved = process.env.BIDX_KEY;
    process.env.BIDX_KEY = "b".repeat(63);
    const { createNameBlindIndex: fn } = await import("./encryption");
    expect(() => fn("test")).toThrow("BIDX_KEY");
    process.env.BIDX_KEY = saved;
  });

  it("throws when BIDX_KEY contains non-hex characters", async () => {
    const saved = process.env.BIDX_KEY;
    process.env.BIDX_KEY = "g".repeat(64); // 'g' is not valid hex
    const { createNameBlindIndex: fn } = await import("./encryption");
    expect(() => fn("test")).toThrow("BIDX_KEY");
    process.env.BIDX_KEY = saved;
  });

  it("accepts lowercase hex keys without throwing", async () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    process.env.BIDX_KEY       = "b".repeat(64);
    const { encryptField: enc, decryptField: dec } = await import("./encryption");
    expect(dec(enc("hello"))).toBe("hello");
  });

  it("accepts uppercase hex keys without throwing", async () => {
    process.env.ENCRYPTION_KEY = "A".repeat(64);
    process.env.BIDX_KEY       = "B".repeat(64);
    const { encryptField: enc, decryptField: dec } = await import("./encryption");
    expect(dec(enc("hello"))).toBe("hello");
  });

  it("accepts mixed-case hex keys", async () => {
    process.env.ENCRYPTION_KEY = ("aAbBcCdD").repeat(8);
    process.env.BIDX_KEY       = ("eEfF0011").repeat(8);
    const { encryptField: enc, decryptField: dec } = await import("./encryption");
    expect(dec(enc("hello"))).toBe("hello");
  });

  // Restore the canonical test keys so any later module loads get them
  it("restores test keys (sentinel)", () => {
    process.env.ENCRYPTION_KEY = TEST_ENC_KEY;
    process.env.BIDX_KEY       = TEST_BIDX_KEY;
    expect(true).toBe(true);
  });
});
