import { describe, expect, it, vi } from "vitest";

// flattenGpsRow is a pure transform, but queries.ts transitively imports the
// Supabase server client (which pulls in next/headers). Stub that module so the
// test stays hermetic — no Supabase client, no network.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { flattenGpsRow } from "./queries";

describe("flattenGpsRow (PERF-2)", () => {
  it("maps case_number and all four cred_* from populated embeds", () => {
    const row = {
      id: "device-1",
      last_lat: 13.7563,
      cases: { case_number: "CASE-001" },
      gps903_credentials: {
        device_name: "Tracker A",
        imei: "356938035643809",
        phone_number: "+66801234567",
        provider: "AIS",
      },
    } as unknown as Parameters<typeof flattenGpsRow>[0];

    const out = flattenGpsRow(row);

    expect(out.case_number).toBe("CASE-001");
    expect(out.cred_name).toBe("Tracker A");
    expect(out.cred_imei).toBe("356938035643809");
    expect(out.cred_phone).toBe("+66801234567");
    expect(out.cred_provider).toBe("AIS");
  });

  it("falls back to null when cases and gps903_credentials are null", () => {
    const row = {
      id: "device-2",
      last_lat: 13.7563,
      cases: null,
      gps903_credentials: null,
    } as unknown as Parameters<typeof flattenGpsRow>[0];

    const out = flattenGpsRow(row);

    expect(out.case_number).toBeNull();
    expect(out.cred_name).toBeNull();
    expect(out.cred_imei).toBeNull();
    expect(out.cred_phone).toBeNull();
    expect(out.cred_provider).toBeNull();
  });
});
