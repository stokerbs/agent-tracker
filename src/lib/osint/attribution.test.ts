import { describe, it, expect } from "vitest";
import { detectCloud, detectCdn, attribute } from "./attribution";

describe("detectCloud", () => {
  it.each([
    ["my-bucket.s3.amazonaws.com", "Amazon S3"],
    ["my-bucket.s3.eu-west-1.amazonaws.com", "Amazon S3"],
    ["assets.r2.cloudflarestorage.com", "Cloudflare R2"],
    ["files.storage.googleapis.com", "Google Cloud Storage"],
    ["acct.blob.core.windows.net", "Azure Blob Storage"],
    ["f000.backblazeb2.com", "Backblaze B2"],
    ["space.nyc3.digitaloceanspaces.com", "DigitalOcean Spaces"],
    ["raw.githubusercontent.com", "GitHub"],
    ["i.imgur.com", "Imgur"],
    ["res.cloudinary.com", "Cloudinary"],
    ["proj.supabase.co", "Supabase Storage"],
  ])("identifies %s as %s", (host, provider) => {
    expect(detectCloud(host).map((m) => m.provider)).toContain(provider);
  });

  it("returns nothing for an unknown host", () => {
    expect(detectCloud("example.com")).toEqual([]);
  });
});

describe("detectCdn", () => {
  it("detects Cloudflare via header", () => {
    const h = new Headers({ "cf-ray": "abc-DFW", server: "cloudflare" });
    expect(detectCdn("example.com", h).map((m) => m.provider)).toContain("Cloudflare");
  });

  it("detects CloudFront via hostname and header", () => {
    const h = new Headers({ "x-amz-cf-id": "xyz" });
    expect(detectCdn("d123.cloudfront.net", h).map((m) => m.provider)).toEqual(["Amazon CloudFront"]);
  });

  it("dedupes a provider matched by both host and header", () => {
    const h = new Headers({ "x-vercel-id": "iad1::abc", server: "Vercel" });
    const cdn = detectCdn("app.vercel.app", h);
    expect(cdn.filter((m) => m.provider === "Vercel")).toHaveLength(1);
  });

  it("returns nothing for a plain host with no CDN headers", () => {
    expect(detectCdn("example.com", new Headers())).toEqual([]);
  });
});

describe("attribute", () => {
  it("combines host, cloud and cdn", () => {
    const h = new Headers({ "cf-ray": "abc" });
    const a = attribute("https://bucket.s3.amazonaws.com/x/y.jpg", h);
    expect(a.host).toBe("bucket.s3.amazonaws.com");
    expect(a.cloud.map((c) => c.provider)).toContain("Amazon S3");
    expect(a.cdn.map((c) => c.provider)).toContain("Cloudflare");
  });

  it("handles a malformed final URL", () => {
    expect(attribute("not a url", new Headers())).toEqual({ host: null, cloud: [], cdn: [] });
  });
});
