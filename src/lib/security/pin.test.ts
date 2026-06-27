import { describe, it, expect } from "vitest";
import { hashPin, verifyPinHash } from "./pin";

describe("pin hashing", () => {
  it("verifies a correct PIN", () => {
    expect(verifyPinHash("1234", hashPin("1234"))).toBe(true);
  });
  it("rejects a wrong PIN", () => {
    expect(verifyPinHash("9999", hashPin("1234"))).toBe(false);
  });
  it("uses salt:hash format with a unique salt each time", () => {
    const a = hashPin("123456");
    const b = hashPin("123456");
    expect(a).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(a).not.toBe(b); // different salt → different stored value
    expect(verifyPinHash("123456", a)).toBe(true);
    expect(verifyPinHash("123456", b)).toBe(true);
  });
  it("rejects a malformed stored hash", () => {
    expect(verifyPinHash("1234", "garbage")).toBe(false);
    expect(verifyPinHash("1234", "")).toBe(false);
  });
});
