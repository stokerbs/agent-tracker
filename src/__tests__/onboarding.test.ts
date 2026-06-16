/**
 * Tests for customer-first onboarding requirements:
 *   1. New signups receive role='client' by default
 *   2. Client cannot access staff-only routes (pure logic / nav)
 *   3. Admin role helpers work correctly
 *
 * Tests that require mocking server actions live in onboarding-action.test.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isStaff, isClient, hasRequiredRole } from "@/lib/auth";
import { navForRole } from "@/components/layout/nav-config";

// ---------------------------------------------------------------------------
// 1. Default role: migration must hardcode 'client'
// ---------------------------------------------------------------------------

describe("signup => client", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/0018_client_onboarding.sql"),
    "utf8",
  );

  it("migration 0018 inserts role='client' in handle_new_user", () => {
    expect(sql).toMatch(/'client',\s+-- All self-registrations/);
  });

  it("migration 0018 does not read role from raw_user_meta_data", () => {
    expect(sql).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/);
  });

  it("migration 0018 updates the column default to 'client'", () => {
    expect(sql).toContain("alter column role set default 'client'");
  });
});

// ---------------------------------------------------------------------------
// 2. Client cannot access staff routes
// ---------------------------------------------------------------------------

describe("client cannot access staff routes", () => {
  it("isStaff returns false for client", () => {
    expect(isStaff("client")).toBe(false);
  });

  it("isClient returns true only for client role", () => {
    expect(isClient("client")).toBe(true);
    expect(isClient("agent")).toBe(false);
    expect(isClient("supervisor")).toBe(false);
    expect(isClient("admin")).toBe(false);
  });

  it("hasRequiredRole: client fails staff-only guard", () => {
    expect(hasRequiredRole("client", ["admin", "supervisor"])).toBe(false);
    expect(hasRequiredRole("client", ["admin"])).toBe(false);
    expect(hasRequiredRole("client", ["agent"])).toBe(false);
  });

  it("navForRole: client nav is empty — clients are redirected to portal", () => {
    const sections = navForRole("client");
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));

    expect(hrefs).not.toContain("/map");
    expect(hrefs).not.toContain("/agents");
    expect(hrefs).not.toContain("/cases");
    expect(hrefs).not.toContain("/expenses");
    expect(hrefs).not.toContain("/emergency");
    expect(hrefs).not.toContain("/audit");
    expect(hrefs).not.toContain("/users");
    expect(hrefs).not.toContain("/clients");
    expect(hrefs).not.toContain("/invoices");
  });

  it("every staff-only route guard blocks clients via hasRequiredRole", () => {
    const guards: Array<[string, string[]]> = [
      ["/map", ["admin", "supervisor"]],
      ["/agents", ["admin", "supervisor"]],
      ["/clients", ["admin", "supervisor"]],
      ["/invoices", ["admin", "supervisor"]],
      ["/emergency", ["admin", "supervisor"]],
      ["/users", ["admin"]],
      ["/audit", ["admin"]],
    ];
    for (const [route, allowed] of guards) {
      expect(
        hasRequiredRole("client", allowed as any),
        `client must be blocked from ${route}`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Admin role helpers
// ---------------------------------------------------------------------------

describe("admin can change roles", () => {
  it("hasRequiredRole: only admin passes the admin-only guard", () => {
    expect(hasRequiredRole("admin", ["admin"])).toBe(true);
    expect(hasRequiredRole("supervisor", ["admin"])).toBe(false);
    expect(hasRequiredRole("agent", ["admin"])).toBe(false);
    expect(hasRequiredRole("client", ["admin"])).toBe(false);
  });

  it("isStaff is true for admin and supervisor only", () => {
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("supervisor")).toBe(true);
    expect(isStaff("agent")).toBe(false);
    expect(isStaff("client")).toBe(false);
  });
});
