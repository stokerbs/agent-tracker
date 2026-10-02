/**
 * Infer the contact channel from a CTA href so every LINE / WhatsApp / phone /
 * email / Facebook / WeChat link on the marketing site reports the same
 * `contact_click` event without each call site repeating the mapping.
 * Pure — unit-tested in contact-channel.test.ts.
 */
export type ContactChannel = "line" | "whatsapp" | "phone" | "email" | "facebook" | "wechat";

export function channelForHref(href: string | undefined | null): ContactChannel | undefined {
  if (!href) return undefined;
  const h = href.trim().toLowerCase();
  if (h.startsWith("tel:")) return "phone";
  if (h.startsWith("mailto:")) return "email";
  if (h.includes("lin.ee/") || h.includes("line.me/")) return "line";
  if (h.includes("whatsapp.com/") || h.startsWith("whatsapp:") || h.includes("wa.me/")) return "whatsapp";
  if (h.includes("facebook.com/") || h.includes("fb.com/") || h.includes("m.me/")) return "facebook";
  if (h.startsWith("weixin:") || h.includes("weixin.qq.com") || h.includes("wechat")) return "wechat";
  return undefined;
}
