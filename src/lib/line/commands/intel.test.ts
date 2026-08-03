import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessages: vi.fn() }));
// Default-allowed so every test below doesn't need to opt in explicitly; the
// rate-limiting tests override with mockResolvedValueOnce.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 1, retryAfterMs: 0 })),
}));
// Deliberately NOT an opaque `plain:${v}` passthrough (see case.test.ts) —
// ciphertext values in this file are always prefixed "enc:" and decrypt to
// whatever follows, so tests can assert the raw "enc:..." string is NEVER
// present in a reply while still getting a realistic, non-identity
// ciphertext -> plaintext mapping. A ciphertext NOT prefixed "enc:" throws,
// simulating a corrupt/undecryptable field for the degrade-gracefully tests.
vi.mock("@/lib/security/encryption", () => ({
  decryptField: vi.fn((v: string) => {
    if (!v.startsWith("enc:")) throw new Error("bad ciphertext");
    return v.slice(4);
  }),
}));

import { handleIntelCommand } from "./intel";
import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessages } from "@/lib/line/reply";
import { checkRateLimit } from "@/lib/rate-limit";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const CASE_ID = "case-1";
const CASE_NUMBER = "CASE-2026-0001";

// ─── minimal query-builder stand-ins ────────────────────────────────────────

type Result = { data: unknown; error: unknown; count?: number | null };

/** Minimal chainable stand-in for a PostgREST query builder — every filter
 * method is a `vi.fn()` returning itself (chainable AND inspectable
 * afterward), resolves via either `.maybeSingle()` or by being awaited
 * directly (`.then`), matching how intel.ts uses the real client for both
 * single-row lookups and the vehicles/locations/relationships list queries. */
function chainable(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "ilike", "eq", "order", "limit"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => result);
  (b as { then: unknown }).then = (
    resolve: (value: Result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return b as {
    select: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  };
}

type Builder = ReturnType<typeof chainable>;

const DEFAULT_LIST_RESULT: Result = { data: [], error: null, count: 0 };
const DEFAULT_PHOTO_RESULT: Result = { data: null, error: null };

/**
 * Wires a mock Supabase client for handleIntelCommand's exact query
 * sequence: [0] `cases` (findAuthorizedCaseByNumber's authorization lookup),
 * [1] `cases` (this command's own intel-columns fetch, scoped by the already-
 * authorized case.id), then `target_vehicles` / `target_locations` /
 * `target_relationships` / `target_photos` (fired together via Promise.all).
 * Every builder handed out is collected (per table, in call order) so tests
 * can assert on the args each query's `.select()`/`.eq()` calls were made
 * with — in particular the authorization filter.
 */
function makeSvc({
  authCaseResult,
  profileResult,
  vehiclesResult = DEFAULT_LIST_RESULT,
  locationsResult = DEFAULT_LIST_RESULT,
  relationshipsResult = DEFAULT_LIST_RESULT,
  primaryPhotoResult = DEFAULT_PHOTO_RESULT,
  signedUrlsResult = { data: [] as Array<{ signedUrl?: string | null; path?: string }>, error: null as unknown },
}: {
  authCaseResult: Result;
  profileResult?: Result;
  vehiclesResult?: Result;
  locationsResult?: Result;
  relationshipsResult?: Result;
  primaryPhotoResult?: Result;
  signedUrlsResult?: { data: Array<{ signedUrl?: string | null; path?: string }>; error: unknown };
}) {
  const caseBuilders: Builder[] = [];
  const vehicleBuilders: Builder[] = [];
  const locationBuilders: Builder[] = [];
  const relationshipBuilders: Builder[] = [];
  const photoBuilders: Builder[] = [];
  const casesQueue = [authCaseResult, profileResult ?? { data: null, error: null }];
  let casesCallIdx = 0;

  const createSignedUrls = vi.fn(async () => signedUrlsResult);
  const storageFrom = vi.fn((_bucket: string) => ({ createSignedUrls }));

  return {
    caseBuilders,
    vehicleBuilders,
    locationBuilders,
    relationshipBuilders,
    photoBuilders,
    createSignedUrls,
    storageFrom,
    storage: { from: storageFrom },
    from(table: string) {
      if (table === "cases") {
        const result = casesQueue[casesCallIdx] ?? { data: null, error: null };
        casesCallIdx++;
        const b = chainable(result);
        caseBuilders.push(b);
        return b;
      }
      if (table === "target_vehicles") {
        const b = chainable(vehiclesResult);
        vehicleBuilders.push(b);
        return b;
      }
      if (table === "target_locations") {
        const b = chainable(locationsResult);
        locationBuilders.push(b);
        return b;
      }
      if (table === "target_relationships") {
        const b = chainable(relationshipsResult);
        relationshipBuilders.push(b);
        return b;
      }
      if (table === "target_photos") {
        const b = chainable(primaryPhotoResult);
        photoBuilders.push(b);
        return b;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function lastMessages(): unknown[] {
  const calls = vi.mocked(replyLineMessages).mock.calls;
  return (calls[calls.length - 1]?.[1] ?? []) as unknown[];
}

function lastText(): string {
  const messages = lastMessages() as Array<{ type: string; text?: string }>;
  const textMsg = messages.find((m) => m.type === "text");
  return textMsg?.text ?? "";
}

function authorizedCaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_ID,
    case_number: CASE_NUMBER,
    client_name: "Somchai Co.",
    target_name_enc: null,
    status: "active",
    case_type: "Infidelity",
    description: null,
    created_at: "2026-01-01T00:00:00.000Z",
    case_agents: [{ agent_id: AGENT_ID }],
    ...overrides,
  };
}

function fullProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    target_name_enc: "enc:สมชาย ใจดี",
    target_alias_enc: "enc:เจ้านาย",
    target_gender: "male",
    target_age: 35,
    target_nationality: "ไทย",
    target_occupation: "นักธุรกิจ",
    target_phone_enc: "enc:0812345678",
    target_address_enc: "enc:123 ถนนสุขุมวิท กรุงเทพฯ",
    target_notes_enc: "enc:มักไปที่ห้างสรรพสินค้าทุกวันศุกร์",
    target_socials_enc: `enc:${JSON.stringify([
      { platform: "facebook", handle: "@somchai" },
      { platform: "line", handle: "line123" },
    ])}`,
    ...overrides,
  };
}

function allowRateLimit() {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 1, retryAfterMs: 0 });
}

afterEach(() => vi.clearAllMocks());

describe("handleIntelCommand", () => {
  it("replies INTEL_EMPTY_ARGS for a blank case number, without touching the DB", async () => {
    await handleIntelCommand(AGENT_ID, "   ", "rt1");
    expect(lastText()).toBe(msg.INTEL_EMPTY_ARGS);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  describe("rate limiting", () => {
    it("replies RATE_LIMITED and never touches the DB when the agent is rate-limited", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 1000 });
      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      expect(lastText()).toBe(msg.RATE_LIMITED);
      expect(createServiceClient).not.toHaveBeenCalled();
    });

    it("checks the line_intel bucket keyed by agentId", async () => {
      allowRateLimit();
      const svc = makeSvc({ authCaseResult: { data: null, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      expect(checkRateLimit).toHaveBeenCalledWith("line_intel", AGENT_ID);
    });
  });

  describe("authorization", () => {
    it("replies CASE_NOT_FOUND for a nonexistent or unauthorized case (never distinguishable)", async () => {
      allowRateLimit();
      const svc = makeSvc({ authCaseResult: { data: null, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, "CASE-NOT-MINE", "rt1");
      expect(lastText()).toBe(msg.CASE_NOT_FOUND);
      // No profile/child-table queries attempted against an unauthorized case.
      expect(svc.vehicleBuilders.length).toBe(0);
    });

    it("replies GENERIC_ERROR when the case-resolution query errors", async () => {
      allowRateLimit();
      const svc = makeSvc({ authCaseResult: { data: null, error: { message: "db down" } } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      expect(lastText()).toBe(msg.GENERIC_ERROR);
    });

    it("authorization regression guard: scopes the case-resolution query to case_agents!inner + this agent's case_agents.agent_id filter", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");

      const authBuilder = svc.caseBuilders[0]!;
      expect(authBuilder.select).toHaveBeenCalledWith(
        expect.stringContaining("case_agents!inner(agent_id)"),
      );
      expect(authBuilder.eq).toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);
    });

    it("parameterizes the case_agents.agent_id filter per agentId — a different agentId produces a different eq() argument", async () => {
      const OTHER_AGENT_ID = "99999999-9999-9999-9999-999999999999";
      allowRateLimit();
      const svc = makeSvc({ authCaseResult: { data: null, error: null } });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(OTHER_AGENT_ID, CASE_NUMBER, "rt1");

      const authBuilder = svc.caseBuilders[0]!;
      expect(authBuilder.eq).toHaveBeenCalledWith("case_agents.agent_id", OTHER_AGENT_ID);
      expect(authBuilder.eq).not.toHaveBeenCalledWith("case_agents.agent_id", AGENT_ID);
    });

    it("scopes the second (intel-columns) cases query by the already-authorized case.id, not a fresh caseNumber lookup", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");

      const profileBuilder = svc.caseBuilders[1]!;
      expect(profileBuilder.eq).toHaveBeenCalledWith("id", CASE_ID);
    });
  });

  describe("DB error paths", () => {
    it("replies GENERIC_ERROR when the intel-columns profile query errors", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: null, error: { message: "db down" } },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      vi.spyOn(console, "error").mockImplementation(() => {});

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      expect(lastText()).toBe(msg.GENERIC_ERROR);
    });

    it("replies GENERIC_ERROR when a child-table (vehicles/locations/relationships/photos) query errors", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
        vehiclesResult: { data: null, error: { message: "db down" }, count: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      vi.spyOn(console, "error").mockImplementation(() => {});

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      expect(lastText()).toBe(msg.GENERIC_ERROR);
    });
  });

  describe("successful profile lookup", () => {
    it("formats every decrypted profile field correctly and never leaks raw ciphertext", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      const text = lastText();

      // Decrypted plaintext present, correctly formatted.
      expect(text).toContain("สมชาย ใจดี");
      expect(text).toContain("เจ้านาย");
      expect(text).toContain("ชาย"); // gender label
      expect(text).toContain("35 ปี");
      expect(text).toContain("ไทย");
      expect(text).toContain("นักธุรกิจ");
      expect(text).toContain("0812345678");
      expect(text).toContain("123 ถนนสุขุมวิท กรุงเทพฯ");
      expect(text).toContain("มักไปที่ห้างสรรพสินค้าทุกวันศุกร์");
      expect(text).toContain("facebook: @somchai");
      expect(text).toContain("line: line123");
      expect(text).toContain(CASE_NUMBER);

      // No raw ciphertext ("enc:...") ever leaks into the reply. Only the
      // `_enc` columns are actually encrypted — `target_gender`/`target_age`/
      // `target_nationality`/`target_occupation` are plaintext columns and
      // are SUPPOSED to appear verbatim, so they're excluded from this check.
      const profile = fullProfileRow();
      for (const [key, value] of Object.entries(profile)) {
        if (key.endsWith("_enc") && typeof value === "string") {
          expect(text).not.toContain(value);
        }
      }
    });

    it("omits null/absent fields rather than printing a placeholder for each", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: {
          data: fullProfileRow({
            target_alias_enc: null,
            target_notes_enc: null,
            target_socials_enc: null,
            target_nationality: null,
            target_occupation: null,
          }),
          error: null,
        },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      const text = lastText();

      expect(text).toContain("สมชาย ใจดี"); // name still present
      expect(text).not.toContain("N/A");
      expect(text).not.toContain("null");
      expect(text).not.toContain("โซเชียล"); // socials line omitted entirely
    });

    it("replies with the INTEL_NO_DATA empty state when the case has no profile fields, vehicles, locations, or relationships", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: {
          data: {
            target_name_enc: null,
            target_alias_enc: null,
            target_gender: null,
            target_age: null,
            target_nationality: null,
            target_occupation: null,
            target_phone_enc: null,
            target_address_enc: null,
            target_notes_enc: null,
            target_socials_enc: null,
          },
          error: null,
        },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      expect(lastText()).toContain(msg.INTEL_NO_DATA);
    });
  });

  describe("decrypt-failure degradation", () => {
    it("degrades a single bad-ciphertext field to absent without blowing up the whole reply", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        // target_phone_enc deliberately NOT prefixed "enc:" -> decryptField throws.
        profileResult: { data: fullProfileRow({ target_phone_enc: "CORRUPT-CIPHERTEXT" }), error: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      const text = lastText();

      // Reply still succeeds with every other field intact.
      expect(text).not.toBe(msg.GENERIC_ERROR);
      expect(text).toContain("สมชาย ใจดี");
      expect(text).toContain("123 ถนนสุขุมวิท กรุงเทพฯ");
      // The failed field is simply absent (no "โทร:" line at all).
      expect(text).not.toContain("โทร:");
      expect(text).not.toContain("0812345678");
      expect(text).not.toContain("CORRUPT-CIPHERTEXT");

      const loggedArgs = errSpy.mock.calls.flat().map(String);
      expect(loggedArgs.some((s) => s.includes("decrypt-failed") && s.includes("field=target_phone"))).toBe(true);
      errSpy.mockRestore();
    });
  });

  describe("vehicles / locations / relationships formatting", () => {
    it("formats vehicle/location/relationship rows, marking the primary vehicle", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
        vehiclesResult: {
          data: [
            { make: "Toyota", model: "Camry", color: "ขาว", license_plate_enc: "enc:กข-1234", is_primary: true, photo_url: null },
            { make: "Honda", model: "Civic", color: null, license_plate_enc: null, is_primary: false, photo_url: null },
          ],
          error: null,
          count: 2,
        },
        locationsResult: {
          data: [{ location_type: "home", location_name: "บ้านพักอาศัย", address_enc: null }],
          error: null,
          count: 1,
        },
        relationshipsResult: {
          data: [{ name_enc: "enc:สมหญิง รักดี", relation: "spouse" }],
          error: null,
          count: 1,
        },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      const text = lastText();

      expect(text).toContain("[หลัก]");
      expect(text).toContain("Toyota");
      expect(text).toContain("กข-1234");
      expect(text).toContain("Honda");
      expect(text).toContain("บ้าน"); // location type label
      expect(text).toContain("บ้านพักอาศัย");
      expect(text).toContain("สมหญิง รักดี");
      expect(text).toContain("คู่สมรส"); // relation label
      expect(text).not.toContain("enc:สมหญิง รักดี");
      expect(text).not.toContain("enc:กข-1234");
    });

    it("caps the vehicles list at the display limit with a '+N more' note when more exist", async () => {
      allowRateLimit();
      const fiveVehicles = Array.from({ length: 5 }, (_, i) => ({
        make: `Make${i}`,
        model: `Model${i}`,
        color: null,
        license_plate_enc: null,
        is_primary: false,
        photo_url: null,
      }));
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
        vehiclesResult: { data: fiveVehicles, error: null, count: 8 },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      const text = lastText();

      expect(text).toContain("ยานพาหนะ (8)");
      expect(text).toContain("Make0");
      expect(text).toContain("Make4");
      expect(text).not.toContain("Make5");
      expect(text).toContain("อีก 3 รายการ");
    });

    it("omits a section header entirely when that category has zero rows", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      const text = lastText();

      expect(text).not.toContain("ยานพาหนะ");
      expect(text).not.toContain("สถานที่");
      expect(text).not.toContain("ความสัมพันธ์");
    });
  });

  describe("photos", () => {
    it("sends the primary target photo and primary vehicle photo as image messages when signing succeeds", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
        vehiclesResult: {
          data: [{ make: "Toyota", model: "Camry", color: null, license_plate_enc: null, is_primary: true, photo_url: "case-1/vehicles/v1/photo.jpg" }],
          error: null,
          count: 1,
        },
        primaryPhotoResult: { data: { storage_path: "case-1/photos/target.jpg" }, error: null },
        signedUrlsResult: {
          data: [
            { signedUrl: "https://signed.example/target.jpg", path: "case-1/photos/target.jpg" },
            { signedUrl: "https://signed.example/vehicle.jpg", path: "case-1/vehicles/v1/photo.jpg" },
          ],
          error: null,
        },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");

      expect(svc.storageFrom).toHaveBeenCalledWith("intelligence");
      expect(svc.createSignedUrls).toHaveBeenCalledWith(
        ["case-1/photos/target.jpg", "case-1/vehicles/v1/photo.jpg"],
        expect.any(Number),
      );

      const messages = lastMessages() as Array<{ type: string; originalContentUrl?: string; previewImageUrl?: string }>;
      expect(messages).toHaveLength(3); // 1 text + 2 images
      expect(messages[0]!.type).toBe("text");
      const images = messages.slice(1);
      expect(images.every((m) => m.type === "image")).toBe(true);
      expect(images.map((m) => m.originalContentUrl)).toEqual([
        "https://signed.example/target.jpg",
        "https://signed.example/vehicle.jpg",
      ]);
      expect(images.every((m) => m.originalContentUrl === m.previewImageUrl)).toBe(true);
    });

    it("skips a photo whose signed-URL generation failed, without failing the whole reply", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
        primaryPhotoResult: { data: { storage_path: "case-1/photos/target.jpg" }, error: null },
        signedUrlsResult: {
          data: [{ signedUrl: null, path: "case-1/photos/target.jpg" }],
          error: null,
        },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");

      const messages = lastMessages() as Array<{ type: string }>;
      expect(messages).toHaveLength(1); // text only — the one photo was skipped
      expect(messages[0]!.type).toBe("text");
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("never calls Storage when there are no photos to sign", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");
      expect(svc.storageFrom).not.toHaveBeenCalled();
    });

    it("never exceeds LINE's 5-message reply cap (1 text + at most 4 images)", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow(), error: null },
        vehiclesResult: {
          data: [{ make: "Toyota", model: "Camry", color: null, license_plate_enc: null, is_primary: true, photo_url: "case-1/vehicles/v1/photo.jpg" }],
          error: null,
          count: 1,
        },
        primaryPhotoResult: { data: { storage_path: "case-1/photos/target.jpg" }, error: null },
        signedUrlsResult: {
          data: [
            { signedUrl: "https://signed.example/target.jpg", path: "case-1/photos/target.jpg" },
            { signedUrl: "https://signed.example/vehicle.jpg", path: "case-1/vehicles/v1/photo.jpg" },
          ],
          error: null,
        },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");

      const messages = lastMessages() as unknown[];
      const imageCount = (messages as Array<{ type: string }>).filter((m) => m.type === "image").length;
      expect(imageCount).toBeLessThanOrEqual(4);
      expect(messages.length).toBeLessThanOrEqual(5);
    });
  });

  describe("logging discipline", () => {
    it("never logs any decrypted PII value via console.log/warn/error across a full successful reply", async () => {
      allowRateLimit();
      const svc = makeSvc({
        authCaseResult: { data: authorizedCaseRow(), error: null },
        profileResult: { data: fullProfileRow({ target_phone_enc: "CORRUPT-CIPHERTEXT" }), error: null },
        vehiclesResult: {
          data: [{ make: "Toyota", model: "Camry", color: "ขาว", license_plate_enc: "enc:กข-1234", is_primary: true, photo_url: null }],
          error: null,
          count: 1,
        },
        locationsResult: {
          data: [{ location_type: "home", location_name: null, address_enc: "enc:123 ถนนสุขุมวิท" }],
          error: null,
          count: 1,
        },
        relationshipsResult: {
          data: [{ name_enc: "enc:สมหญิง รักดี", relation: "spouse" }],
          error: null,
          count: 1,
        },
      });
      vi.mocked(createServiceClient).mockReturnValue(svc as never);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await handleIntelCommand(AGENT_ID, CASE_NUMBER, "rt1");

      const decryptedPiiValues = [
        "สมชาย ใจดี", // target_name
        "เจ้านาย", // target_alias
        "123 ถนนสุขุมวิท กรุงเทพฯ", // target_address (profile)
        "123 ถนนสุขุมวิท", // target_address (location)
        "มักไปที่ห้างสรรพสินค้าทุกวันศุกร์", // target_notes
        "@somchai", // social handle
        "กข-1234", // vehicle plate
        "สมหญิง รักดี", // relationship name
      ];

      const allLoggedText = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errSpy.mock.calls]
        .flat()
        .map((v) => (typeof v === "string" ? v : JSON.stringify(v)));

      for (const pii of decryptedPiiValues) {
        expect(allLoggedText.some((s) => s.includes(pii))).toBe(false);
      }
      // Ciphertext itself must never be logged either.
      expect(allLoggedText.some((s) => s.includes("enc:สมชาย ใจดี"))).toBe(false);

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errSpy.mockRestore();
    });
  });
});
