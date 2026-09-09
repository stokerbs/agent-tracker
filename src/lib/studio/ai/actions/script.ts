import "server-only";

import { estimateSpokenSeconds } from "@/lib/studio/duration";
import type { Pillar, Platform, SourceRef, SupportStatus, TargetDuration } from "@/lib/studio/types";
import { ctaUserPrompt, hooksUserPrompt, rewriteUserPrompt, type RewriteMode } from "../prompts/rewrite";
import { CtaResponseSchema, HooksResponseSchema, RewriteResponseSchema, ScriptResponseSchema } from "../prompts/schemas";
import { scriptUserPrompt } from "../prompts/script";
import { runStructured, type RunResult } from "../run";
import { buildContext, resolveSourceRefs } from "./context";

export interface GeneratedClaim {
  claim: string;
  support_status: SupportStatus;
  source: SourceRef | null;
}

export interface GeneratedScript {
  hook: string;
  script: string;
  caption: string;
  cta: string;
  estimated_duration_sec: number;
  ai_notes: string;
  source_refs: SourceRef[];
  claims: GeneratedClaim[];
}

export interface GenerateScriptInput {
  title: string;
  hook?: string | null;
  description?: string | null;
  pillar: Pillar;
  platform: Platform;
  targetSeconds: TargetDuration;
  tone?: string | null;
  existingScript?: string | null;
  /** Extra retrieval terms (e.g. idea tags). */
  searchHint?: string | null;
  userId: string | null;
}

export async function generateScript(input: GenerateScriptInput): Promise<RunResult<GeneratedScript>> {
  const query = [input.title, input.description ?? "", input.searchHint ?? ""].join(" ");
  const ctx = await buildContext(query, { limit: 8, pillar: input.pillar });
  const res = await runStructured({
    purpose: "script",
    schema: ScriptResponseSchema,
    system: ctx.system,
    user: scriptUserPrompt({
      title: input.title,
      hook: input.hook,
      description: input.description,
      pillar: input.pillar,
      platform: input.platform,
      targetSeconds: input.targetSeconds,
      tone: input.tone,
      knowledgeContext: ctx.knowledgeContext,
      existingScript: input.existingScript,
    }),
    inputRefs: { title: input.title, pillar: input.pillar, platform: input.platform, target: input.targetSeconds, knowledge_ids: ctx.hits.map((h) => h.id) },
    userId: input.userId,
    effort: "high",
  });
  if (!res.ok) return res;
  const d = res.data;
  const claims: GeneratedClaim[] = d.claims.map((c) => {
    const [src] = resolveSourceRefs([c.source_ref], ctx.refs);
    const status: SupportStatus = !src || src.kind === "ai_general" ? "ai_suggestion" : c.confidence === "partially_supported" ? "partially_supported" : "supported";
    return { claim: c.claim.trim(), support_status: status, source: src ?? null };
  });
  return {
    ok: true,
    generationId: res.generationId,
    model: res.model,
    data: {
      hook: d.hook.trim(),
      script: d.script.trim(),
      caption: d.caption.trim(),
      cta: d.cta.trim(),
      // Our own estimator wins over the model's guess — consistent with the editor.
      estimated_duration_sec: estimateSpokenSeconds(d.script) || Math.round(d.estimated_seconds),
      ai_notes: d.ai_notes.trim(),
      source_refs: resolveSourceRefs(d.source_refs, ctx.refs),
      claims,
    },
  };
}

export async function generateHooks(input: {
  title: string;
  pillar: Pillar;
  description?: string | null;
  currentHook?: string | null;
  userId: string | null;
}): Promise<RunResult<{ hooks: { text: string; angle: string; why: string }[] }>> {
  const ctx = await buildContext(`${input.title} ${input.description ?? ""}`, { limit: 5, pillar: input.pillar });
  const res = await runStructured({
    purpose: "hooks",
    schema: HooksResponseSchema,
    system: ctx.system,
    user: hooksUserPrompt({ title: input.title, pillar: input.pillar, description: input.description, currentHook: input.currentHook, knowledgeContext: ctx.knowledgeContext }),
    inputRefs: { title: input.title, pillar: input.pillar },
    userId: input.userId,
    effort: "medium",
    maxTokens: 3000,
  });
  if (!res.ok) return res;
  return { ok: true, generationId: res.generationId, model: res.model, data: { hooks: res.data.hooks.slice(0, 8) } };
}

export async function generateCTA(input: {
  title: string;
  pillar: Pillar;
  platform: Platform | null;
  script?: string | null;
  userId: string | null;
}): Promise<RunResult<{ options: { text: string; style: string }[] }>> {
  const ctx = await buildContext("", {});
  const res = await runStructured({
    purpose: "cta",
    schema: CtaResponseSchema,
    system: ctx.system,
    user: ctaUserPrompt({ title: input.title, pillar: input.pillar, platform: input.platform, script: input.script }),
    inputRefs: { title: input.title, pillar: input.pillar },
    userId: input.userId,
    effort: "low",
    maxTokens: 2000,
  });
  if (!res.ok) return res;
  return { ok: true, generationId: res.generationId, model: res.model, data: { options: res.data.options.slice(0, 6) } };
}

export async function rewriteContent(input: {
  mode: RewriteMode;
  field: "hook" | "script" | "caption" | "cta";
  text: string;
  title: string;
  pillar: Pillar;
  platform: Platform | null;
  customInstruction?: string | null;
  userId: string | null;
}): Promise<RunResult<{ text: string; change_note: string }>> {
  const ctx = await buildContext("", {});
  const res = await runStructured({
    purpose: `rewrite:${input.mode}`,
    schema: RewriteResponseSchema,
    system: ctx.system,
    user: rewriteUserPrompt({
      mode: input.mode,
      field: input.field,
      text: input.text,
      context: { title: input.title, pillar: input.pillar, platform: input.platform },
      customInstruction: input.customInstruction,
    }),
    inputRefs: { title: input.title, field: input.field, mode: input.mode, chars: input.text.length },
    userId: input.userId,
    effort: input.mode === "more_viral" || input.mode === "alternative_version" ? "medium" : "low",
    maxTokens: 4000,
  });
  if (!res.ok) return res;
  return { ok: true, generationId: res.generationId, model: res.model, data: { text: res.data.text.trim(), change_note: res.data.change_note.trim() } };
}
