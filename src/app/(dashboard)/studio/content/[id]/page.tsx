import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isAiAvailable, resolveAiConfig } from "@/lib/studio/ai";
import { getStudioSettings } from "@/lib/studio/settings";
import { getMasterWithRelations } from "../queries";
import { ContentEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function ContentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, settings, ai] = await Promise.all([getMasterWithRelations(id), getStudioSettings(), resolveAiConfig()]);
  if (!data) notFound();

  const aiAvailable = isAiAvailable(ai.provider);
  const aiReason = aiAvailable
    ? undefined
    : ai.provider === "openai"
      ? "เลือก provider OpenAI ไว้ แต่ V1 รองรับเฉพาะ Anthropic"
      : "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บนเซิร์ฟเวอร์";

  return <ContentEditor data={data} aiAvailable={aiAvailable} aiReason={aiReason} approvalRules={settings.approval_rules} />;
}
