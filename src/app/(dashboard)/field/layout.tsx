import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { FieldTabBar } from "@/components/field/field-tab-bar";

/**
 * Field layout — wraps the field/mobile experience in the Federal Tactical
 * theme (`.theme-tactical`), bleeding past the dashboard <main> padding so the
 * navy surface fills the screen. Adds the classification strip and the mobile
 * bottom tab bar. Scoped here so the rest of the staff dashboard is untouched.
 */
export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("field");
  const profile = await requireProfile();

  return (
    <div className="theme-tactical -mx-4 -my-4 min-h-[calc(100vh-3.5rem)] bg-background text-foreground sm:-mx-6 sm:-my-6 lg:-mx-7 lg:-my-7">
      {/* Classification strip */}
      <div className="border-t-2 border-primary/80 bg-popover">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-1.5 font-mono text-[10px] tracking-[0.15em] text-primary">
          <span>{t("classification.banner")}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" />
            {t("classification.secure")}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pb-24 pt-4">{children}</div>

      <FieldTabBar role={profile.role} />
    </div>
  );
}
