/**
 * Phone number parsing (in-process, no third party).
 *
 * Uses libphonenumber-js/max — the `/max` metadata bundle is required for
 * getType() (mobile / fixed_line / voip). Never throws: an unparseable value
 * returns an all-null, invalid PhoneInfo.
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import type { PhoneInfo } from "./types";

const EMPTY: PhoneInfo = {
  valid: false,
  possible: false,
  e164: null,
  national: null,
  international: null,
  country: null,
  countryCallingCode: null,
  lineType: null,
};

/**
 * Parse a phone number. `region` (ISO-3166, e.g. "TH") is used to interpret
 * local-format numbers like "0812345678"; E.164 inputs (+66…) ignore it.
 */
export function parsePhone(value: string, region?: string): PhoneInfo {
  let parsed;
  try {
    parsed = parsePhoneNumberFromString(value.trim(), region as CountryCode | undefined);
  } catch {
    return { ...EMPTY };
  }
  if (!parsed) return { ...EMPTY };

  // Only surface a formatted number when it's at least a possible number;
  // otherwise the "E.164" would be a misleading normalization of junk digits.
  const possible = parsed.isPossible();
  return {
    valid: parsed.isValid(),
    possible,
    e164: possible ? parsed.number : null,
    national: possible ? parsed.formatNational() : null,
    international: possible ? parsed.formatInternational() : null,
    country: parsed.country ?? null,
    countryCallingCode: parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : null,
    lineType: parsed.getType()?.toLowerCase() ?? null,
  };
}
