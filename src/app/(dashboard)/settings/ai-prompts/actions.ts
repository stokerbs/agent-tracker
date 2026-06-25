"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/server";
import { handleDbError } from "@/lib/errors";

export async function saveAiPrompt(promptId: string, promptText: string) {
  const profile = await requireRole(["admin"]);
  const trimmed = promptText.trim();
  if (!trimmed) return { error: "Prompt text cannot be empty." };

  const supabase = createServiceClient();

  // Save version snapshot first.
  await supabase.from("ai_prompt_versions").insert({
    prompt_id: promptId,
    prompt_text: trimmed,
    saved_by: profile.id,
  });

  // Update the prompt.
  const { error } = await supabase
    .from("ai_prompts")
    .update({ prompt_text: trimmed })
    .eq("id", promptId);
  if (error) return { error: handleDbError(error, "ai_prompts") };

  await logAudit({
    actorId: profile.id,
    action: "AI_PROMPT_UPDATE",
    entity: "ai_prompts",
    entityId: promptId,
    metadata: { version_saved: true },
  });
  revalidatePath("/settings/ai-prompts");
  return { ok: true };
}

export async function resetAiPromptToDefault(promptId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = createServiceClient();

  const { data: prompt } = await supabase
    .from("ai_prompts")
    .select("default_text")
    .eq("id", promptId)
    .single();
  if (!prompt) return { error: "Prompt not found." };

  // Save version snapshot of the current text before resetting.
  const { data: current } = await supabase
    .from("ai_prompts")
    .select("prompt_text")
    .eq("id", promptId)
    .single();
  if (current) {
    await supabase.from("ai_prompt_versions").insert({
      prompt_id: promptId,
      prompt_text: current.prompt_text,
      saved_by: profile.id,
    });
  }

  const { error } = await supabase
    .from("ai_prompts")
    .update({ prompt_text: prompt.default_text })
    .eq("id", promptId);
  if (error) return { error: handleDbError(error, "ai_prompts") };

  await logAudit({
    actorId: profile.id,
    action: "AI_PROMPT_RESET",
    entity: "ai_prompts",
    entityId: promptId,
  });
  revalidatePath("/settings/ai-prompts");
  return { ok: true };
}

export async function restoreAiPromptVersion(promptId: string, versionText: string) {
  const actor = await requireRole(["admin"]);
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("ai_prompts")
    .update({ prompt_text: versionText })
    .eq("id", promptId);
  if (error) return { error: handleDbError(error, "ai_prompts") };

  await logAudit({
    actorId: actor.id,
    action: "AI_PROMPT_RESTORE",
    entity: "ai_prompts",
    entityId: promptId,
  });
  revalidatePath("/settings/ai-prompts");
  return { ok: true };
}
