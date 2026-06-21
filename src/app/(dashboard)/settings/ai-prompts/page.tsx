import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getAllAiPrompts, getAiPromptVersions } from "@/lib/ai-prompts";
import { PageHeader } from "@/components/shared/page-header";
import { AiPromptEditor } from "@/components/settings/ai-prompt-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "AI Prompt Management" };
export const dynamic = "force-dynamic";

export default async function AiPromptsPage() {
  await requireRole(["admin"]);
  const t = await getTranslations("settings");
  const tNav = await getTranslations("nav");
  const prompts = await getAllAiPrompts();

  const promptsWithVersions = await Promise.all(
    prompts.map(async (p) => ({
      prompt: p,
      versions: await getAiPromptVersions(p.id),
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Link href="/settings" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> {tNav("items.settings")}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground">{t("aiPrompts")}</span>
      </div>

      <PageHeader
        title={t("aiPromptsTitle")}
        description={t("aiPromptsDescription")}
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        {t("aiPromptsSecurityNote")}
      </div>

      <div className="space-y-6">
        {promptsWithVersions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {t("aiPromptsEmpty")}
            </CardContent>
          </Card>
        ) : (
          promptsWithVersions.map(({ prompt, versions }) => (
            <Card key={prompt.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  {prompt.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AiPromptEditor prompt={prompt} versions={versions} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
