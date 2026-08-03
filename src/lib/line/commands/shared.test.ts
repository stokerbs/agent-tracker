import { describe, expect, it } from "vitest";
import { escapeIlikeTerm } from "./shared";

// Finding 4 (security review): a literal backslash in user input must be
// escaped BEFORE `%`/`_` are escaped, otherwise `a\%` becomes `a\\%`, which
// Postgres still parses as an escaped backslash followed by an unescaped
// (wildcard) `%` — silently reintroducing the wildcard this function exists
// to neutralize.
describe("escapeIlikeTerm", () => {
  it("escapes % and _ as literals", () => {
    expect(escapeIlikeTerm("50%_off")).toBe("50\\%\\_off");
  });

  it("escapes a literal backslash so a trailing wildcard can't be smuggled through it", () => {
    expect(escapeIlikeTerm("a\\%")).toBe("a\\\\\\%");
  });

  it("leaves plain text untouched", () => {
    expect(escapeIlikeTerm("Somchai")).toBe("Somchai");
  });
});
