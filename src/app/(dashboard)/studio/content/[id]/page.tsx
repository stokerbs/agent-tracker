import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isAiAvailable, resolveAiConfig } from "@/lib/studio/ai";
import { getMediaAvailability } from "@/lib/studio/media/provider";
import { getPublishAvailability } from "@/lib/studio/publish/provider";
import { getStudioSettings } from "@/lib/studio/settings";
import { getMasterWithRelations } from "../queries";
import { ContentEditor } from "./editor";

export const dynamic = "force-dynamic";
// Media generation server actions (Gemini ≤ 90 s, ElevenLabs ≤ 120 s) run under this segment's limit.
export const maxDuration = 150;

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

  // Only booleans + Thai reasons cross to the client — never the key material itself.
  const media = getMediaAvailability(settings.media_prefs);
  const mediaAvailability = {
    image: { available: media.image.available, reason: media.image.reason },
    tts: { available: media.tts.available, reason: media.tts.reason },
  };

  // Same rule for the publish provider: a boolean + reason cross the boundary, the Ayrshare key stays on the server.
  const publish = getPublishAvailability();
  const socialAvailability = { available: publish.available, reason: publish.reason };

  return (
    <ContentEditor
      data={data}
      aiAvailable={aiAvailable}
      aiReason={aiReason}
      approvalRules={settings.approval_rules}
      mediaAvailability={mediaAvailability}
      defaultAspect={settings.media_prefs.default_aspect}
      socialAvailability={socialAvailability}
      socialConnections={settings.social_connections}
    />
  );
}
