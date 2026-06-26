import { describe, expect, it } from "vitest";
import { notificationLinks, relProfileId } from "./notification-links";

// Deep links must be built in exactly one place — never hardcoded at call sites.
describe("notificationLinks (single source of deep links)", () => {
  it("builds case + portal links from an id", () => {
    expect(notificationLinks.case("abc")).toBe("/cases/abc");
    expect(notificationLinks.portalCase("abc")).toBe("/portal/cases/abc");
    expect(notificationLinks.emergency("a1")).toBe("/emergency/a1");
  });

  it("builds the static destinations", () => {
    expect(notificationLinks.portal()).toBe("/portal");
    expect(notificationLinks.expenses()).toBe("/expenses");
    expect(notificationLinks.payroll()).toBe("/payroll");
    expect(notificationLinks.map()).toBe("/map");
  });
});

describe("relProfileId (embedded relation normaliser)", () => {
  it("reads from an array-shaped relation", () => {
    expect(relProfileId([{ profile_id: "p1" }])).toBe("p1");
  });
  it("reads from an object-shaped relation", () => {
    expect(relProfileId({ profile_id: "p2" })).toBe("p2");
  });
  it("returns null for empty / null / missing", () => {
    expect(relProfileId([])).toBeNull();
    expect(relProfileId(null)).toBeNull();
    expect(relProfileId(undefined)).toBeNull();
    expect(relProfileId([{ profile_id: null }])).toBeNull();
  });
});
