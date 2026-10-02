import { describe, expect, it } from "vitest";
import { channelForHref } from "./contact-channel";

describe("channelForHref", () => {
  it("maps the firm's real CTA hrefs", () => {
    expect(channelForHref("https://lin.ee/SSqk98x")).toBe("line");
    expect(channelForHref("https://page.line.me/detectivepluse")).toBe("line");
    expect(channelForHref("https://api.whatsapp.com/send?phone=+66968461406")).toBe("whatsapp");
    expect(channelForHref("https://wa.me/66968461406")).toBe("whatsapp");
    expect(channelForHref("tel:+66968461406")).toBe("phone");
    expect(channelForHref("mailto:detectivepluse@gmail.com")).toBe("email");
    expect(channelForHref("https://www.facebook.com/Detectivepluse.th")).toBe("facebook");
  });

  it("is case-insensitive and tolerant of whitespace", () => {
    expect(channelForHref("  TEL:0968461406 ")).toBe("phone");
    expect(channelForHref("HTTPS://LIN.EE/abc")).toBe("line");
  });

  it("returns undefined for non-contact links", () => {
    expect(channelForHref("#contact")).toBeUndefined();
    expect(channelForHref("/en/contact")).toBeUndefined();
    expect(channelForHref("https://detectivepulse.com/articles")).toBeUndefined();
    expect(channelForHref(undefined)).toBeUndefined();
    expect(channelForHref("")).toBeUndefined();
  });
});
