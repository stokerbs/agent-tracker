import { createServiceClient } from "@/lib/supabase/server";

export interface AiPrompt {
  id: string;
  prompt_key: string;
  name: string;
  description: string | null;
  prompt_text: string;
  default_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiPromptVersion {
  id: string;
  prompt_id: string;
  prompt_text: string;
  saved_by: string | null;
  saved_at: string;
}

/**
 * Loads the active prompt text for a given key.
 * Falls back to the provided hardcoded default if the DB row is missing.
 * Uses the service client so RLS never blocks server-side report generation.
 */
export async function getAiPromptText(
  key: string,
  fallback: string,
): Promise<string> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("ai_prompts")
      .select("prompt_text, is_active")
      .eq("prompt_key", key)
      .single();
    if (data?.is_active && data.prompt_text?.trim()) return data.prompt_text;
  } catch {
    // Non-fatal — fall through to hardcoded default.
  }
  return fallback;
}

/** Loads all prompts for the admin UI. */
export async function getAllAiPrompts(): Promise<AiPrompt[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ai_prompts")
    .select("*")
    .order("prompt_key");
  return (data as AiPrompt[]) ?? [];
}

/** Loads version history for a prompt (most recent first, limit 20). */
export async function getAiPromptVersions(
  promptId: string,
): Promise<AiPromptVersion[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ai_prompt_versions")
    .select("*")
    .eq("prompt_id", promptId)
    .order("saved_at", { ascending: false })
    .limit(20);
  return (data as AiPromptVersion[]) ?? [];
}
