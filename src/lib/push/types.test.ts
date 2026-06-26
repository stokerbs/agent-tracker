import { describe, expect, it } from "vitest";
import { apnsPriority, notificationData, type PushPayload } from "./types";

// The shared payload builder is the single source of truth for the data map
// attached to every push (APNs custom keys / FCM message.data). These tests lock
// down the contract the native tap/foreground handlers rely on.
describe("notificationData (shared push payload builder)", () => {
  it("maps url to both url and link (back-compat tap handler)", () => {
    const data = notificationData({ title: "T", url: "/cases/abc" });
    expect(data.url).toBe("/cases/abc");
    expect(data.link).toBe("/cases/abc");
  });

  it("falls back to the deprecated link field when url is absent", () => {
    const data = notificationData({ title: "T", link: "/portal" });
    expect(data.url).toBe("/portal");
    expect(data.link).toBe("/portal");
  });

  it("carries type, entityId, priority and createdAt", () => {
    const payload: PushPayload = {
      title: "SOS",
      type: "emergency",
      entityId: "alert-1",
      priority: "high",
      createdAt: "2026-06-26T00:00:00.000Z",
    };
    const data = notificationData(payload);
    expect(data.type).toBe("emergency");
    expect(data.entityId).toBe("alert-1");
    expect(data.priority).toBe("high");
    expect(data.createdAt).toBe("2026-06-26T00:00:00.000Z");
  });

  it("omits absent fields (no empty keys)", () => {
    const data = notificationData({ title: "Bare" });
    expect(Object.keys(data)).toHaveLength(0);
  });
});

describe("apnsPriority", () => {
  it("maps high (and the default) to 10, normal to 5", () => {
    expect(apnsPriority("high")).toBe("10");
    expect(apnsPriority(undefined)).toBe("10");
    expect(apnsPriority("normal")).toBe("5");
  });
});
