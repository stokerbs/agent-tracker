/**
 * Tests that admin-only server actions correctly enforce the admin guard.
 * Mocks are top-level so vi.mock hoisting works correctly.
 */

import { describe, it, expect, vi } from "vitest";

// vi.hoisted runs before vi.mock factories — use it to create shareable mocks
const requireRoleMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "admin-user-id", role: "admin" }),
);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/errors", () => ({
  handleDbError: vi.fn(() => "db error"),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, requireRole: requireRoleMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  })),
}));

describe("admin can change roles — server action guard", () => {
  it("updateUserRole calls requireRole(['admin'])", async () => {
    const { updateUserRole } = await import(
      "@/app/(dashboard)/users/actions"
    );

    await updateUserRole("target-user-id", "agent");

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
  });

  it("updateUserRole returns error when supabase fails", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: { code: "42501", message: "denied" } })),
        })),
      })),
    } as any);

    const { updateUserRole } = await import(
      "@/app/(dashboard)/users/actions"
    );

    const result = await updateUserRole("target-user-id", "supervisor");
    expect(result).toHaveProperty("error");
  });
});
