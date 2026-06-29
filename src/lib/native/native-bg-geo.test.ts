import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module registers a Capacitor plugin at import time — stub it so the test
// is hermetic (no native runtime).
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({}) }));

import { flushQueue } from "./native-bg-geo";

const KEY = "dp_gps_queue";

function seedQueue(initial: unknown[]) {
  const store = new Map<string, string>();
  if (initial.length) store.set(KEY, JSON.stringify(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  return () => JSON.parse(store.get(KEY) ?? "[]");
}

beforeEach(() => vi.stubGlobal("navigator", { onLine: true }));
afterEach(() => vi.unstubAllGlobals());

describe("flushQueue — offline GPS backfill replay", () => {
  it("sends every queued fix and clears the queue on full success", async () => {
    const read = seedQueue([{ lat: 1, recorded_at: "t1" }, { lat: 2, recorded_at: "t2" }]);
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    await flushQueue("tok");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(read()).toEqual([]);
  });

  it("stops at the first failure and keeps the remainder (oldest-first)", async () => {
    const read = seedQueue([{ lat: 1 }, { lat: 2 }, { lat: 3 }]);
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { n += 1; return { ok: n < 2 } as Response; }));

    await flushQueue("tok");

    // first sent, request #2 failed → 2nd and 3rd retained
    expect(read()).toEqual([{ lat: 2 }, { lat: 3 }]);
  });

  it("no-ops on an empty queue", async () => {
    seedQueue([]);
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    await flushQueue("tok");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send while offline", async () => {
    seedQueue([{ lat: 1 }]);
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    await flushQueue("tok");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
