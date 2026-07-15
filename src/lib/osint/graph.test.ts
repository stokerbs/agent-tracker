import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";
import type { AnalysisResult } from "./types";

function result(over: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    id: "a1",
    status: "complete",
    stageStatus: {},
    caseId: null,
    sourceType: "url",
    storagePath: null,
    metadata: null,
    hashes: null,
    redirects: [],
    attribution: null,
    integrity: null,
    reverseSearch: [],
    faces: [],
    objects: [],
    ocr: [],
    geolocation: null,
    error: null,
    ...over,
  };
}

describe("buildGraph", () => {
  it("always has an image node", () => {
    const g = buildGraph(result());
    expect(g.nodes.find((n) => n.type === "image")).toBeTruthy();
  });

  it("chains redirect domains and links cloud + cdn to the host", () => {
    const g = buildGraph(
      result({
        redirects: [
          { hopIndex: 0, kind: "http", url: "https://pimeyes.com/r", statusCode: 302, resolvedHost: "pimeyes.com", resolvedIp: "1.2.3.4" },
          { hopIndex: 1, kind: "origin", url: "https://bucket.s3.amazonaws.com/p.jpg", statusCode: 200, resolvedHost: "bucket.s3.amazonaws.com", resolvedIp: "5.6.7.8" },
        ],
        attribution: {
          host: "bucket.s3.amazonaws.com",
          cloud: [{ provider: "Amazon S3", evidence: "x" }],
          cdn: [{ provider: "Cloudflare", evidence: "y" }],
        },
      }),
    );
    const types = g.nodes.map((n) => n.type);
    expect(types).toContain("domain");
    expect(types).toContain("cloud");
    expect(types).toContain("cdn");
    // redirect chain edge between the two domains
    expect(g.edges.some((e) => e.label === "redirect")).toBe(true);
    // cloud/cdn anchored to the final host
    expect(g.edges.some((e) => e.target === "cloud:Amazon S3")).toBe(true);
    expect(g.edges.some((e) => e.target === "cdn:Cloudflare")).toBe(true);
  });

  it("adds face and object nodes hung off the image", () => {
    const g = buildGraph(
      result({
        faces: [
          { faceIndex: 0, bbox: { x: 0, y: 0, w: 0.1, h: 0.1 }, blurScore: null, yaw: null, pitch: null, roll: null, hasGlasses: null, hasMask: null, confidence: 0.9 },
        ],
        objects: [{ label: "car", category: "vehicle", bbox: null, confidence: 0.8 }],
      }),
    );
    expect(g.nodes.find((n) => n.type === "face")).toBeTruthy();
    expect(g.nodes.find((n) => n.type === "object" && n.label === "car")).toBeTruthy();
    expect(g.edges.some((e) => e.target === "face:0")).toBe(true);
    expect(g.edges.some((e) => e.target === "object:car")).toBe(true);
  });

  it("adds an AI-location node when geolocation is present", () => {
    const g = buildGraph(
      result({
        geolocation: {
          provider: "picarta",
          lat: 43.46,
          lon: 11.04,
          confidence: 0.9,
          country: "Italy",
          city: "San Gimignano",
          province: "Tuscany",
          predictions: [],
        },
      }),
    );
    expect(g.nodes.find((n) => n.type === "location")).toBeTruthy();
    expect(g.edges.some((e) => e.target === "location:ai")).toBe(true);
  });

  it("adds a case node when linked", () => {
    const g = buildGraph(result({ caseId: "c1" }));
    expect(g.nodes.find((n) => n.type === "case")).toBeTruthy();
    expect(g.edges.some((e) => e.target === "case:c1")).toBe(true);
  });

  it("produces no duplicate nodes or edges", () => {
    const g = buildGraph(
      result({
        redirects: [
          { hopIndex: 0, kind: "http", url: "https://x.com/a", statusCode: 200, resolvedHost: "x.com", resolvedIp: "1.1.1.1" },
          { hopIndex: 1, kind: "http", url: "https://x.com/b", statusCode: 200, resolvedHost: "x.com", resolvedIp: "1.1.1.1" },
        ],
        attribution: { host: "x.com", cloud: [], cdn: [] },
      }),
    );
    const nodeIds = g.nodes.map((n) => n.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    const edgeIds = g.edges.map((e) => e.id);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });
});
