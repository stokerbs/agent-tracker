import { Facebook, Instagram, MessageCircle, Music2, Youtube, type LucideProps } from "lucide-react";
import type { SocialPlatform } from "@/lib/studio/types";

/** Brand-ish glyph per social platform (lucide has no TikTok mark — a note icon stands in). */
const ICON: Record<SocialPlatform, React.ComponentType<LucideProps>> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  line_oa: MessageCircle,
};

const TONE: Record<SocialPlatform, string> = {
  facebook: "text-blue-600 dark:text-blue-400",
  instagram: "text-pink-600 dark:text-pink-400",
  tiktok: "text-foreground",
  youtube: "text-red-600 dark:text-red-400",
  line_oa: "text-emerald-600 dark:text-emerald-400",
};

export function PlatformIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const Icon = ICON[platform];
  return <Icon className={`${TONE[platform]} ${className ?? "h-4 w-4"}`} aria-hidden="true" />;
}
