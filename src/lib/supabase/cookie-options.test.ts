import { describe, it, expect } from "vitest";
import { persistAuthCookie, SESSION_COOKIE_MAX_AGE } from "./cookie-options";

describe("persistAuthCookie", () => {
  it("sets a long maxAge on sb-* auth cookie writes", () => {
    const out = persistAuthCookie("sb-access-token", "jwt", { httpOnly: true, path: "/" });
    expect(out).toMatchObject({ httpOnly: true, path: "/", maxAge: SESSION_COOKIE_MAX_AGE });
  });

  it("does NOT override deletions (value empty) — sign-out must still expire", () => {
    const del = { maxAge: 0, path: "/" };
    expect(persistAuthCookie("sb-access-token", "", del)).toBe(del);
  });

  it("does NOT override an explicit maxAge:0 even with a value", () => {
    const del = { maxAge: 0 };
    expect(persistAuthCookie("sb-refresh-token", "x", del)).toBe(del);
  });

  it("leaves non-sb cookies untouched", () => {
    const opts = { maxAge: 60 };
    expect(persistAuthCookie("other", "v", opts)).toBe(opts);
  });
});
