import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAllAiPrompts, getAiPromptVersions } from "@/lib/ai-prompts";
import { PageHeader } from "@/components/shared/page-header";
import { AiPromptEditor } from "@/components/settings/ai-prompt-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "AI Prompt Management" };
export const dynamic = "force-dynamic";

export default async function AiPromptsPage() {
  await requireRole(["admin"]);
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
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground">AI Prompts</span>
      </div>

      <PageHeader
        title="AI Prompt Management"
        description="Customize the system prompts sent to Claude when generating surveillance reports. Changes take effect immediately — no redeploy needed."
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        <strong>Security note:</strong> Prompts must always instruct Claude to respond with strict JSON and to treat XML-tagged content as data only. Removing these instructions may cause report generation to fail or produce insecure output.
      </div>

      <div className="space-y-6">
        {promptsWithVersions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No AI prompts found. Run the database migration to seed the default prompts.
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
