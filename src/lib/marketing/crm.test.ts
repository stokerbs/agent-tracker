import { describe, expect, it } from "vitest";
import { CHANNELS, LEAD_QUALITIES, LOST_REASONS, channelFor, isChannel, isLeadQuality, isLostReason } from "./crm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("CRM vocabulary", () => {
  it("matches the check constraints in migration 0128", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0128_marketing_leads_crm.sql"), "utf8");
    for (const q of LEAD_QUALITIES) expect(sql).toContain(`'${q}'`);
    for (const r of LOST_REASONS) expect(sql).toContain(`'${r}'`);
    for (const c of CHANNELS) expect(sql).toContain(`'${c}'`);
    expect(isLeadQuality("qualified")).toBe(true);
    expect(isLeadQuality("great")).toBe(false);
    expect(isLostReason("price")).toBe(true);
    expect(isChannel("paid_search")).toBe(true);
  });

  it("derives the acquisition channel from first-touch attribution", () => {
    expect(channelFor({ gclid: "abc" })).toBe("paid_search");
    expect(channelFor({ utm_medium: "CPC", utm_source: "google" })).toBe("paid_search");
    expect(channelFor({ fbclid: "x" })).toBe("paid_social");
    expect(channelFor({ utm_source: "partner-law-firm-ab12cd" })).toBe("partner");
    expect(channelFor({ referrer: "https://www.facebook.com/" })).toBe("social");
    expect(channelFor({ referrer: "https://www.google.com/" })).toBe("organic_search");
    expect(channelFor({ referrer: "https://www.google.co.th/" })).toBe("organic_search");
    expect(channelFor({ referrer: "https://pantip.com/topic/1" })).toBe("referral");
    // Own-host referrer alone says nothing about acquisition.
    expect(channelFor({ referrer: "https://detectivepulse.com/en" })).toBe("unknown");
    expect(channelFor({ referrer: "https://detectivepulse.com/en", landing_page: "/en" })).toBe("direct");
    expect(channelFor({ landing_page: "/" })).toBe("direct");
    expect(channelFor({})).toBe("unknown");
    // gclid wins over a social referrer (paid click that bounced through a share).
    expect(channelFor({ gclid: "g", referrer: "https://facebook.com" })).toBe("paid_search");
  });
});
