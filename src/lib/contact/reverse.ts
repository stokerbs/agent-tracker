/**
 * Reverse-lookup launch links for a contact identifier.
 *
 * We do NOT scrape — we only build URLs an investigator opens themselves. Links
 * are tailored per identifier type (phone / email / username).
 */

import type { ContactInputType, ContactReverseLink, PhoneInfo } from "./types";

function enc(v: string): string {
  return encodeURIComponent(v);
}

/**
 * Build launch links. For phones we prefer the E.164 form (from parsePhone) for
 * search accuracy, falling back to the raw value.
 */
export function buildContactReverseLinks(
  type: ContactInputType,
  value: string,
  phone?: PhoneInfo | null,
): ContactReverseLink[] {
  if (type === "phone") {
    const e164 = phone?.e164 ?? value;
    const digits = e164.replace(/[^\d+]/g, "");
    return [
      { engine: "google", label: "Google", url: `https://www.google.com/search?q=${enc(`"${e164}"`)}` },
      { engine: "truecaller", label: "Truecaller", url: `https://www.truecaller.com/search/${(phone?.country ?? "th").toLowerCase()}/${enc(digits)}` },
      { engine: "facebook", label: "Facebook", url: `https://www.facebook.com/search/top?q=${enc(e164)}` },
      { engine: "whocalld", label: "WhoCalld", url: `https://whocalld.com/${enc(digits)}` },
    ];
  }
  if (type === "email") {
    return [
      { engine: "google", label: "Google", url: `https://www.google.com/search?q=${enc(`"${value}"`)}` },
      { engine: "hibp", label: "Have I Been Pwned", url: `https://haveibeenpwned.com/` },
      { engine: "epieos", label: "Epieos", url: `https://epieos.com/` },
    ];
  }
  // username
  return [
    { engine: "google", label: "Google", url: `https://www.google.com/search?q=${enc(`"${value}"`)}` },
    { engine: "namechk", label: "Namechk", url: `https://namechk.com/` },
    { engine: "whatsmyname", label: "WhatsMyName", url: `https://whatsmyname.app/` },
  ];
}
