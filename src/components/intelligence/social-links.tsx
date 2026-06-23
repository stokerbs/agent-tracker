import { Facebook, Instagram, Music2 } from "lucide-react";
import { socialUrl, type SocialMap, type SocialPlatform } from "@/lib/socials";
import { cn } from "@/lib/utils";

const ROWS: { key: SocialPlatform; label: string; Icon: typeof Facebook; color: string }[] = [
  { key: "facebook", label: "Facebook", Icon: Facebook, color: "text-blue-500" },
  { key: "instagram", label: "Instagram", Icon: Instagram, color: "text-pink-500" },
  { key: "tiktok", label: "TikTok", Icon: Music2, color: "text-foreground" },
];

/**
 * View-mode social links inside the Target Intelligence dossier.
 * Each value is tappable and opens in a new tab (external app/browser on mobile).
 * Renders nothing when no handles are set, so the dossier stays compact.
 */
export function SocialLinks({ socials, className }: { socials: SocialMap; className?: string }) {
  const rows = ROWS.filter((r) => socials[r.key]);
  if (rows.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {rows.map(({ key, label, Icon, color }) => {
        const value = socials[key]!;
        return (
          <a
            key={key}
            href={socialUrl(key, value)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 text-sm"
          >
            <Icon className={cn("h-4 w-4 shrink-0", color)} />
            <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
            <span className="truncate font-medium text-primary group-hover:underline">{value}</span>
          </a>
        );
      })}
    </div>
  );
}
