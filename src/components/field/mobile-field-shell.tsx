import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { FieldTabBar } from "@/components/field/field-tab-bar";

/**
 * Mobile-only Federal Tactical shell for shared dashboard pages (cases, map,
 * alerts) that the field agent reaches from the tab bar. On phones / the native
 * app it applies the tactical theme (`.theme-tactical-mobile` — tokens scoped to
 * `<lg` in globals.css), bleeds to fill the screen, and adds the classification
 * strip + bottom tab bar. On desktop (lg+) it is inert: tokens don't apply, the
 * chrome is hidden, and the layout/padding reset to the default dashboard look.
 */
export async function MobileFieldShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("field");
  const profile = await requireProfile();

  return (
    <div className="theme-tactical-mobile -mx-4 -my-4 min-h-[calc(100vh-3.5rem)] bg-background px-4 pb-24 text-foreground sm:-mx-6 sm:-my-6 sm:px-6 lg:mx-0 lg:my-0 lg:min-h-0 lg:bg-transparent lg:px-0 lg:pb-0">
      {/* Classification strip — mobile only */}
      <div className="border-t-2 border-primary/80 bg-popover lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-1.5 font-mono text-[10px] tracking-[0.15em] text-primary">
          <span>{t("classification.banner")}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" />
            {t("classification.secure")}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-md pt-4 lg:max-w-none lg:pt-0">{children}</div>

      <FieldTabBar role={profile.role} />
    </div>
  );
}
