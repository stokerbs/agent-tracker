// Social-media helpers for the Target Intelligence dossier.
// Storage stays in cases.target_socials_enc as an encrypted JSON array of
// { platform, handle }. The dossier surfaces three standard platforms; any
// other platforms extracted by AI intake are preserved on edit.

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialMap = Record<SocialPlatform, string | null>;

export interface SocialEntry {
  platform: string;
  handle: string | null;
}

export const EMPTY_SOCIALS: SocialMap = { facebook: null, instagram: null, tiktok: null };

/** Parse the decrypted target_socials_enc JSON into the 3 standard handles + extras. */
export function parseSocials(json: string | null): { map: SocialMap; others: SocialEntry[] } {
  const map: SocialMap = { facebook: null, instagram: null, tiktok: null };
  const others: SocialEntry[] = [];
  if (!json) return { map, others };
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) {
      for (const s of arr) {
        const platform = String(s?.platform ?? "").toLowerCase().trim();
        const handle = s?.handle != null ? String(s.handle).trim() : null;
        if (!handle) continue;
        if (platform.includes("facebook") || platform === "fb") map.facebook = handle;
        else if (platform.includes("instagram") || platform === "ig") map.instagram = handle;
        else if (platform.includes("tiktok") || platform === "tik tok") map.tiktok = handle;
        else others.push({ platform: String(s?.platform ?? "").trim() || "other", handle });
      }
    }
  } catch {
    // ignore malformed JSON — treat as no socials
  }
  return { map, others };
}

/** Rebuild the storage array from edited standard handles + preserved extras. */
export function serializeSocials(map: Partial<SocialMap>, others: SocialEntry[] = []): SocialEntry[] {
  const out: SocialEntry[] = [];
  for (const p of SOCIAL_PLATFORMS) {
    const handle = map[p]?.trim();
    if (handle) out.push({ platform: p, handle });
  }
  for (const o of others) if (o.handle) out.push(o);
  return out;
}

/** Build an absolute, openable URL from a handle/value for a given platform. */
export function socialUrl(platform: SocialPlatform, handle: string): string {
  const v = handle.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const stripped = v.replace(/^\/+/, "");
  const user = v.replace(/^@/, "").replace(/^\/+/, "");
  switch (platform) {
    case "facebook":
      return v.includes("facebook.com") ? `https://${stripped}` : `https://facebook.com/${user}`;
    case "instagram":
      return v.includes("instagram.com") ? `https://${stripped}` : `https://instagram.com/${user}`;
    case "tiktok":
      return v.includes("tiktok.com") ? `https://${stripped}` : `https://tiktok.com/@${user}`;
  }
}
