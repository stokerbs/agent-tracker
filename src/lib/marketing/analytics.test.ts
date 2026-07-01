import { describe, expect, it } from "vitest";
import { channelFromHref } from "./analytics";

describe("channelFromHref", () => {
  it("classifies the firm's real contact channels", () => {
    expect(channelFromHref("tel:+66968461406")).toBe("phone");
    expect(channelFromHref("mailto:detectivepluse@gmail.com")).toBe("email");
    expect(channelFromHref("https://lin.ee/SSqk98x")).toBe("line");
    expect(channelFromHref("https://line.me/ti/p/xyz")).toBe("line");
    expect(channelFromHref("https://api.whatsapp.com/send?phone=+66809188324")).toBe("whatsapp");
    expect(channelFromHref("https://wa.me/66809188324")).toBe("whatsapp");
    expect(channelFromHref("https://www.facebook.com/Detectivepluse.th")).toBe("facebook");
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(channelFromHref("  TEL:+66968461406 ")).toBe("phone");
    expect(channelFromHref("HTTPS://LIN.EE/ABC")).toBe("line");
  });

  it("returns null for ordinary navigation and empty input", () => {
    expect(channelFromHref("/นักสืบชู้สาว")).toBeNull();
    expect(channelFromHref("https://detectivepulse.com/en")).toBeNull();
    expect(channelFromHref("#services")).toBeNull();
    expect(channelFromHref("")).toBeNull();
    expect(channelFromHref(null)).toBeNull();
    expect(channelFromHref(undefined)).toBeNull();
  });
});
