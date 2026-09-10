import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Database,
  ImageIcon,
  Layers,
  Link2,
  Link2Off,
  Mic,
  Mic2,
  Radar,
  ScrollText,
  Share2,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStudioSettings } from "@/lib/studio/settings";
import { isAiAvailable, resolveAiConfig } from "@/lib/studio/ai/provider";
import { getMediaAvailability } from "@/lib/studio/media/provider";
import { PLATFORM_LABEL } from "@/lib/studio/publish/captions";
import { bangkokDay } from "@/lib/studio/autopilot/plan";
import { getPublishAvailability } from "@/lib/studio/publish/provider";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/studio/types";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiModelTag, AiUnavailableBanner } from "@/components/studio/ai-status";
import { Pill, PillarBadge } from "@/components/studio/badges";
import { BrandVoiceForm } from "./brand-voice-form";
import { PlatformsForm } from "./platforms-form";
import { PillarsForm } from "./pillars-form";
import { AiProviderForm } from "./ai-provider-form";
import { KnowledgePrefsForm } from "./knowledge-prefs-form";
import { PrivacyRulesForm } from "./privacy-rules-form";
import { ApprovalForm } from "./approval-form";
import { DemoDataForm, type DemoCounts } from "./demo-data-form";
import { MediaForm } from "./media-form";
import { SocialForm } from "./social-form";
import { AutopilotForm } from "./autopilot-form";
import { RUN_STATUS_META, formatDays, nextRunLabel, normaliseRunStatus, runReason, runStatsSummary } from "./autopilot-format";
import { normalizeKnowledgePrefs } from "./knowledge-prefs";
import { formatDateTimeBkk } from "../content/format";

export const metadata: Metadata = { title: "Studio Settings" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const LOG_LIMIT = 30;
const RUN_LIMIT = 5;

/** Columns of studio_autopilot_runs the history list needs (no free text from the content itself). */
interface AutopilotRunRow {
  id: string;
  created_at: string;
  status: string;
  step: string | null;
  stopped_at: string | null;
  error: string | null;
  pillar: string | null;
  platforms: string[];
  master_id: string | null;
  published: boolean;
  trigger: string;
  stats: unknown;
}

interface GenerationRow {
  id: string;
  created_at: string;
  purpose: string;
  model: string;
  provider: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  error: string | null;
}

export default async function StudioSettingsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();

  const countDemo = (table: "studio_knowledge_sources" | "studio_cases" | "studio_customer_questions") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("is_demo", true);
  const countTagged = (table: "studio_ideas" | "studio_content_masters") =>
    supabase.from(table).select("id", { count: "exact", head: true }).contains("tags", ["demo"]);

  const [settings, aiConfig, kRes, cRes, qRes, iRes, mRes, logRes, tokRes, runRes] = await Promise.all([
    getStudioSettings(),
    resolveAiConfig(),
    countDemo("studio_knowledge_sources"),
    countDemo("studio_cases"),
    countDemo("studio_customer_questions"),
    countTagged("studio_ideas"),
    countTagged("studio_content_masters"),
    supabase
      .from("studio_ai_generations")
      .select("id, created_at, purpose, model, provider, status, input_tokens, output_tokens, duration_ms, error")
      .order("created_at", { ascending: false })
      .limit(LOG_LIMIT),
    supabase.from("studio_ai_generations").select("input_tokens, output_tokens, status").gte("created_at", since30).limit(2000),
    supabase
      .from("studio_autopilot_runs")
      .select("id, created_at, status, step, stopped_at, error, pillar, platforms, master_id, published, trigger, stats")
      .order("created_at", { ascending: false })
      .limit(RUN_LIMIT),
  ]);

  for (const [label, r] of [["log", logRes], ["tokens", tokRes], ["autopilot runs", runRes]] as const) {
    if (r.error) console.error(`[studio:settings] ${label} query failed:`, r.error.message);
  }
  const autopilotRunsFailed = !!runRes.error;

  const demoCounts: DemoCounts = {
    knowledge: kRes.count ?? 0,
    cases: cRes.count ?? 0,
    questions: qRes.count ?? 0,
    ideas: iRes.count ?? 0,
    masters: mRes.count ?? 0,
  };

  const generations = (logRes.data ?? []) as GenerationRow[];
  const tokRows = (tokRes.data ?? []) as { input_tokens: number | null; output_tokens: number | null; status: string }[];
  const tok30 = tokRows.reduce(
    (acc, r) => ({ input: acc.input + (r.input_tokens ?? 0), output: acc.output + (r.output_tokens ?? 0), calls: acc.calls + 1, errors: acc.errors + (r.status === "ok" ? 0 : 1) }),
    { input: 0, output: 0, calls: 0, errors: 0 },
  );

  const aiReady = isAiAvailable(aiConfig.provider);
  const knowledgePrefs = normalizeKnowledgePrefs(settings.knowledge_prefs);
  const media = getMediaAvailability(settings.media_prefs);
  // Only the boolean crosses to the client; the Ayrshare key itself never leaves the server.
  const publish = getPublishAvailability();
  const social = settings.social_connections;
  const autopilot = settings.autopilot;
  const autopilotRuns = (runRes.data ?? []) as AutopilotRunRow[];
  const today = bangkokDay(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าสตูดิโอ"
        description="น้ำเสียงแบรนด์ · แพลตฟอร์ม · สัดส่วน pillar · AI · สื่อ (รูป/เสียง) · โซเชียล · โหมดอัตโนมัติ · กฎความเป็นส่วนตัว/การอนุมัติ · ข้อมูลตัวอย่าง · บันทึกการเรียก AI"
      >
        {settings.updated_at && new Date(settings.updated_at).getTime() > 0 && (
          <span className="text-xs text-muted-foreground">อัปเดตล่าสุด {formatDate(settings.updated_at)}</span>
        )}
      </PageHeader>

      {!aiReady && <AiUnavailableBanner reason={aiConfig.provider === "openai" ? "เลือก provider OpenAI ซึ่งยังไม่รองรับใน V1" : undefined} />}

      {/* 1. Brand voice */}
      <Section icon={<Mic2 className="h-4 w-4" />} title="น้ำเสียงแบรนด์ (Brand Voice)" description="ทุก prompt ของสตูดิโอเริ่มจากค่านี้ — เปลี่ยนที่นี่ = เปลี่ยนทุกโมดูล">
        <BrandVoiceForm initial={settings.brand_voice} />
      </Section>

      {/* 2. Default platforms */}
      <Section icon={<Share2 className="h-4 w-4" />} title="แพลตฟอร์มเริ่มต้น" description="เลือกไว้ล่วงหน้าเมื่อสร้างไอเดีย/คอนเทนต์ใหม่ (แก้ทีละชิ้นได้เสมอ)">
        <PlatformsForm initial={settings.default_platforms} />
      </Section>

      {/* 3. Pillars */}
      <Section icon={<Layers className="h-4 w-4" />} title="สัดส่วน Content Pillars" description="เป้าหมายส่วนแบ่งคอนเทนต์ต่อเดือน — ใช้เทียบกับของจริงในแดชบอร์ดเพื่อเตือนเมื่อเอียง">
        <PillarsForm initial={settings.pillars} />
      </Section>

      {/* 4. AI provider */}
      <Section icon={<Bot className="h-4 w-4" />} title="AI Provider & โมเดล" description="เลือก provider/โมเดล — API key อยู่ใน ENV เท่านั้น ไม่มีช่องกรอกที่นี่โดยตั้งใจ">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatusTile label="Provider ที่ใช้อยู่" value={aiConfig.provider === "anthropic" ? "Anthropic (Claude)" : "OpenAI"} />
          <StatusTile label="โมเดลที่ใช้อยู่" value={<AiModelTag model={aiConfig.model} />} hint={settings.ai_model ? "จากตั้งค่า" : process.env.STUDIO_AI_MODEL ? "จาก ENV STUDIO_AI_MODEL" : "ค่าเริ่มต้นของระบบ"} />
          <StatusTile
            label="สถานะ API key"
            value={
              <Badge variant={aiReady ? "default" : "destructive"} className="gap-1">
                {aiReady ? <CheckCircle2 className="h-3 w-3" /> : null}
                {aiReady ? "Configured" : "Missing key"}
              </Badge>
            }
            hint="ตั้งค่า ANTHROPIC_API_KEY ใน Vercel/ENV เท่านั้น ไม่เก็บในฐานข้อมูล"
          />
        </div>
        <AiProviderForm initialProvider={aiConfig.provider} initialModel={aiConfig.model} />
      </Section>

      {/* 4b. Media (images + voice-over) */}
      <Section
        id="media"
        icon={<ImageIcon className="h-4 w-4" />}
        title="สื่อ (รูป / เสียงพากย์)"
        description="สร้างภาพนิ่งด้วย Gemini และเสียงพากย์ไทยด้วย ElevenLabs จาก Content Editor — API key อยู่ใน ENV เท่านั้น"
        badge={<Pill className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400">Phase 1</Pill>}
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatusTile
            label="สถานะ Gemini key (ภาพ)"
            value={
              <Badge variant={media.image.available ? "default" : "destructive"} className="gap-1">
                {media.image.available ? <CheckCircle2 className="h-3 w-3" /> : null}
                {media.image.available ? "Configured" : "Missing key"}
              </Badge>
            }
            hint="ตั้ง GEMINI_API_KEY ใน Vercel/ENV เท่านั้น ไม่เก็บในฐานข้อมูล"
          />
          <StatusTile
            label="สถานะ ElevenLabs key (เสียง)"
            value={
              <Badge variant={media.tts.available ? "default" : "destructive"} className="gap-1">
                {media.tts.available ? <CheckCircle2 className="h-3 w-3" /> : null}
                {media.tts.available ? "Configured" : "Missing key"}
              </Badge>
            }
            hint="ตั้ง ELEVENLABS_API_KEY ใน Vercel/ENV เท่านั้น ไม่เก็บในฐานข้อมูล"
          />
          <StatusTile
            label="โมเดลที่ใช้อยู่"
            value={
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-xs">
                  <ImageIcon className="h-3 w-3 text-muted-foreground" /> <AiModelTag model={media.image.model} />
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <Mic className="h-3 w-3 text-muted-foreground" /> <AiModelTag model={media.tts.model} />
                </span>
              </div>
            }
            hint={`voice ${media.tts.voiceId} · ${settings.media_prefs.image_model || settings.media_prefs.tts_voice_id ? "มีค่าจากตั้งค่า" : "ค่าจาก ENV/ระบบ"}`}
          />
        </div>
        <MediaForm initial={settings.media_prefs} placeholders={{ imageModel: media.image.model, ttsModel: media.tts.model, voiceId: media.tts.voiceId }} />
      </Section>

      {/* 4c. Social publishing (Ayrshare) */}
      <Section
        id="social"
        icon={<Share2 className="h-4 w-4" />}
        title="การเชื่อมต่อโซเชียล (โพสต์อัตโนมัติ)"
        description="โพสต์ไป Facebook · Instagram · TikTok · YouTube ผ่าน Ayrshare จาก Content Editor — API key อยู่ใน ENV เท่านั้น"
        badge={<Pill className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400">Phase 2</Pill>}
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatusTile
            label="สถานะ Ayrshare key"
            value={
              <Badge variant={publish.available ? "default" : "destructive"} className="gap-1">
                {publish.available ? <CheckCircle2 className="h-3 w-3" /> : null}
                {publish.available ? "Configured" : "Missing key"}
              </Badge>
            }
            hint="ตั้ง AYRSHARE_API_KEY ใน Vercel/ENV เท่านั้น ไม่เก็บในฐานข้อมูล"
          />
          <StatusTile
            label="บัญชีที่เชื่อมต่อ"
            value={
              <ul className="flex flex-wrap gap-1.5" aria-label="บัญชีที่เชื่อมต่อ">
                {SOCIAL_PLATFORMS.map((p) => {
                  const on = social.ayrshare.active.includes(p);
                  const name = social.ayrshare.display_names[p];
                  return (
                    <li key={p}>
                      <Pill
                        className={on ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground"}
                        dot={on ? "bg-emerald-500" : "bg-muted-foreground/50"}
                        title={on ? `เชื่อมต่อแล้ว${name ? ` — ${name}` : ""}` : "ยังไม่เชื่อมต่อ"}
                      >
                        {on ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
                        {PLATFORM_LABEL[p]}
                        {on && name ? <span className="max-w-[120px] truncate font-normal opacity-80">· {name}</span> : null}
                      </Pill>
                    </li>
                  );
                })}
              </ul>
            }
            hint={social.ayrshare.active.length === 0 ? "ยังไม่มีบัญชีที่เชื่อม — ลิงก์ใน Ayrshare แล้วกดรีเฟรช" : `${social.ayrshare.active.length.toLocaleString("en-GB")} จาก ${SOCIAL_PLATFORMS.length.toLocaleString("en-GB")} แพลตฟอร์ม`}
          />
          <StatusTile label="ตรวจล่าสุด" value={social.ayrshare.checked_at ? formatDateTimeBkk(social.ayrshare.checked_at) : "ยังไม่เคย"} hint="กด “รีเฟรชการเชื่อมต่อ” เพื่อถาม Ayrshare ใหม่" />
        </div>
        <SocialForm initial={social.defaults} configured={publish.available} />
      </Section>

      {/* 4d. Autopilot (scheduled end-to-end production) */}
      <Section
        id="autopilot"
        icon={<Radar className="h-4 w-4" />}
        title="โหมดอัตโนมัติ (Autopilot)"
        description="ให้สตูดิโอผลิตและโพสต์เองตามตารางที่ตั้งไว้ — 1 รอบ = คอนเทนต์ 1 ชิ้น ตั้งแต่เลือกหัวข้อ เขียนสคริปต์ สร้างภาพ/เสียง ตัดต่อวิดีโอ ตรวจความเป็นส่วนตัว จนถึงโพสต์"
        badge={<Pill className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400">Phase 4</Pill>}
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatusTile
            label="สถานะ"
            value={
              <Badge variant={autopilot.enabled ? "default" : "secondary"} className="gap-1">
                {autopilot.enabled ? <CheckCircle2 className="h-3 w-3" /> : null}
                {autopilot.enabled ? "เปิด" : "ปิด"}
              </Badge>
            }
            hint={autopilot.enabled ? `สูงสุด ${autopilot.max_runs_per_week.toLocaleString("en-GB")} รอบต่อสัปดาห์` : "ระบบจะไม่ผลิตหรือโพสต์เองจนกว่าจะเปิด"}
          />
          <StatusTile
            label="วันที่ทำงาน"
            value={formatDays(autopilot.days)}
            hint={autopilot.enabled ? `รอบถัดไป ${nextRunLabel(autopilot.days, today)}` : `ตั้งไว้ ${autopilot.days.length.toLocaleString("en-GB")} วันต่อสัปดาห์`}
          />
          <StatusTile
            label="โหมดโพสต์"
            value={autopilot.auto_publish ? "โพสต์เอง" : "รอตรวจก่อน"}
            hint={
              autopilot.auto_publish
                ? "โพสต์ขึ้นเพจจริงโดยไม่มีคนอ่านก่อน — ผล Privacy Check blocked หยุดเสมอ"
                : "ผลิตจนเสร็จแล้วพักไว้ที่สถานะรอตรวจให้เจ้าของกดโพสต์เอง"
            }
          />
        </div>

        <AutopilotForm initial={autopilot} />

        <div className="mt-6 border-t pt-5">
          <h3 className="text-sm font-medium">รอบล่าสุด</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{RUN_LIMIT.toLocaleString("en-GB")} รอบล่าสุด — อ่านอย่างเดียว · เก็บเฉพาะขั้นตอนและตัวเลข ไม่เก็บข้อความสคริปต์</p>
          <AutopilotRuns runs={autopilotRuns} loadFailed={autopilotRunsFailed} />
        </div>
      </Section>

      {/* 5. Knowledge prefs */}
      <Section
        icon={<BookOpen className="h-4 w-4" />}
        title="ค่าตั้งค่าความรู้ (Knowledge)"
        description="บันทึกค่าไว้เพื่อใช้กับตัวค้นหาความรู้ในอนาคต — V1 ยังไม่ได้อ่านค่าเหล่านี้"
        badge={<Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">เตรียมไว้สำหรับ RAG</Pill>}
      >
        <KnowledgePrefsForm initial={knowledgePrefs} />
      </Section>

      {/* 6. Privacy rules */}
      <Section icon={<ShieldCheck className="h-4 w-4" />} title="กฎความเป็นส่วนตัว (Privacy Rules)" description="ตัวตรวจแบบ deterministic ใช้ denylist + regex เหล่านี้ทุกครั้งก่อนอนุมัติ — บันทึกลง audit log">
        <PrivacyRulesForm initial={settings.privacy_rules} />
      </Section>

      {/* 7. Approval */}
      <Section icon={<CheckCircle2 className="h-4 w-4" />} title="กฎการอนุมัติคอนเทนต์" description="มนุษย์อนุมัติเสมอ — ค่านี้กำหนดว่าเข้มแค่ไหน">
        <ApprovalForm initial={settings.approval_rules} />
      </Section>

      {/* 8. Demo data */}
      <Section icon={<Database className="h-4 w-4" />} title="ข้อมูลตัวอย่าง (Demo data)" description="สำหรับลองใช้สตูดิโอก่อนมีข้อมูลจริง">
        <div className="mb-4 rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">สิ่งที่จะถูกเพิ่ม</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>
              <span className="text-foreground">FAQ จริงของบริษัท</span> (จาก lib/marketing/faq) → คลังความรู้ <span className="font-medium">is_demo = false</span> — ถือเป็นความรู้จริง ไม่ถูกลบเมื่อกด &quot;ลบข้อมูลตัวอย่าง&quot;
            </li>
            <li>ความรู้นักสืบตัวอย่าง 8 เรื่อง, เคส DEMO-001…003 พร้อมบทเรียน, คำถามลูกค้าตัวอย่าง (is_demo = true)</li>
            <li>ไอเดีย 5 รายการ + คอนเทนต์ตัวอย่าง 3 ชิ้น (approved / draft / published พร้อมสถิติตัวอย่าง) ติด tag &quot;demo&quot;</li>
          </ul>
        </div>
        <DemoDataForm counts={demoCounts} />
      </Section>

      {/* 9. AI generation log */}
      <Section
        icon={<ScrollText className="h-4 w-4" />}
        title="บันทึกการเรียก AI"
        description={`${LOG_LIMIT} ครั้งล่าสุด — อ่านอย่างเดียว · เก็บเฉพาะ id/brief สั้น ๆ ไม่เก็บข้อความเคสดิบ`}
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatusTile label="เรียก AI (30 วัน)" value={tok30.calls.toLocaleString("en-GB")} hint={tok30.errors ? `ล้มเหลว/ปฏิเสธ ${tok30.errors}` : "ไม่มีข้อผิดพลาด"} />
          <StatusTile label="Input tokens (30 วัน)" value={tok30.input.toLocaleString("en-GB")} />
          <StatusTile label="Output tokens (30 วัน)" value={tok30.output.toLocaleString("en-GB")} />
          <StatusTile label="รวม tokens (30 วัน)" value={(tok30.input + tok30.output).toLocaleString("en-GB")} />
        </div>

        {generations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <Sparkles className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">ยังไม่มีการเรียก AI</p>
            <p className="mt-1 text-xs text-muted-foreground/70">เมื่อสร้างไอเดีย สคริปต์ หรือตรวจความเป็นส่วนตัวด้วย AI รายการจะแสดงที่นี่</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">เวลา</TableHead>
                  <TableHead>งาน</TableHead>
                  <TableHead>โมเดล</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">In / Out</TableHead>
                  <TableHead className="text-right">ms</TableHead>
                  <TableHead>ข้อผิดพลาด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generations.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(g.created_at)}{" "}
                      {new Date(g.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{g.purpose}</TableCell>
                    <TableCell className="text-xs">
                      <span className="text-muted-foreground">{g.provider}/</span>
                      {g.model}
                    </TableCell>
                    <TableCell>
                      <GenStatus status={g.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {g.input_tokens ?? "—"} / {g.output_tokens ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{g.duration_ms ?? "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-destructive" title={g.error ?? undefined}>
                      {g.error ? (g.error.length > 80 ? `${g.error.slice(0, 80)}…` : g.error) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  description,
  badge,
  children,
}: {
  /** Anchor target (e.g. /studio/settings#media). */
  id?: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={id ? "scroll-mt-4" : undefined}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">{icon}</span>
          {title}
          {badge}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Read-only history of autopilot runs — server-rendered, no client JS. */
function AutopilotRuns({ runs, loadFailed }: { runs: AutopilotRunRow[]; loadFailed: boolean }) {
  // "Never ran" and "could not read the history" must not look the same on a page that arms automatic posting.
  if (loadFailed) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-xs text-destructive" role="alert">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>อ่านประวัติรอบอัตโนมัติไม่สำเร็จ — รีเฟรชหน้าอีกครั้ง (ไม่ได้แปลว่าไม่มีรอบที่ทำงาน)</span>
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <div className="mt-3 flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
        <Radar className="mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">ยังไม่เคยมีรอบอัตโนมัติ</p>
        <p className="mt-1 text-xs text-muted-foreground/70">เมื่อเปิดโหมดอัตโนมัติและถึงวันที่ตั้งไว้ ผลของแต่ละรอบจะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {runs.map((run) => {
        const meta = RUN_STATUS_META[normaliseRunStatus(run.status)];
        const stats = runStatsSummary(run.stats);
        return (
          <li key={run.id} className="rounded-lg border px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill className={meta.className} dot={meta.dot}>
                {meta.label}
              </Pill>
              {run.pillar && <PillarBadge pillar={run.pillar} />}
              {run.platforms.map((p) => (
                <Pill key={p} className="border-border bg-muted text-muted-foreground">
                  {PLATFORM_LABEL[p as SocialPlatform] ?? p}
                </Pill>
              ))}
              {run.trigger === "manual" && <Pill className="border-border bg-muted text-muted-foreground">สั่งเอง</Pill>}
              <span className="ml-auto whitespace-nowrap text-[11px] text-muted-foreground">{formatDateTimeBkk(run.created_at)}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {runReason(run)}
              {run.published && <span className="text-emerald-600 dark:text-emerald-400"> · โพสต์แล้ว</span>}
            </p>
            {stats && <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/80">{stats}</p>}
            {run.error && (
              <p className="mt-1 line-clamp-2 text-xs text-destructive" title={run.error}>
                {run.error}
              </p>
            )}
            {run.master_id && (
              <Link href={`/studio/content/${run.master_id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                เปิดคอนเทนต์ <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StatusTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function GenStatus({ status }: { status: string }) {
  if (status === "ok") return <Pill className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" dot="bg-emerald-500">ok</Pill>;
  if (status === "refused") return <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" dot="bg-amber-500">refused</Pill>;
  return <Pill className="bg-destructive/10 text-destructive border-destructive/30" dot="bg-destructive">error</Pill>;
}
