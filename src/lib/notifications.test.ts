import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SEC-5 (FLAG-1): notifications.ts must be a server-only internal module, NOT a
// "use server" action file. The "use server" directive would expose notifyUsers /
// notifyRole as unauthenticated, directly-invocable server-action endpoints that
// perform RLS-bypassing writes via createServiceClient(). Lock the fix in source.
describe("notifications module directive (SEC-5)", () => {
  const source = readFileSync(
    join(__dirname, "notifications.ts"),
    "utf8",
  );

  it("does not declare a \"use server\" directive", () => {
    expect(source).not.toMatch(/^\s*["']use server["'];?/m);
  });

  it("starts with the server-only import directive", () => {
    expect(source.trimStart()).toMatch(/^import ["']server-only["'];/);
  });
});
