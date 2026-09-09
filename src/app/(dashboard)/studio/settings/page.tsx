import type { Metadata } from "next";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Database,
  Layers,
  Link2Off,
  Mic2,
  ScrollText,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStudioSettings } from "@/lib/studio/settings";
import { isAiAvailable, resolveAiConfig } from "@/lib/studio/ai/provider";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiModelTag, AiUnavailableBanner } from "@/components/studio/ai-status";
import { Pill } from "@/components/studio/badges";
import { BrandVoiceForm } from "./brand-voice-form";
import { PlatformsForm } from "./platforms-form";
import { PillarsForm } from "./pillars-form";
import { AiProviderForm } from "./ai-provider-form";
import { KnowledgePrefsForm } from "./knowledge-prefs-form";
import { PrivacyRulesForm } from "./privacy-rules-form";
import { ApprovalForm } from "./approval-form";
import { DemoDataForm, type DemoCounts } from "./demo-data-form";
import { normalizeKnowledgePrefs } from "./knowledge-prefs";

export const metadata: Metadata = { title: "Studio Settings" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const LOG_LIMIT = 30;

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

const SOCIALS: { key: string; label: string }[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
];

export default async function StudioSettingsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();

  const countDemo = (table: "studio_knowledge_sources" | "studio_cases" | "studio_customer_questions") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("is_demo", true);
  const countTagged = (table: "studio_ideas" | "studio_content_masters") =>
    supabase.from(table).select("id", { count: "exact", head: true }).contains("tags", ["demo"]);

  const [settings, aiConfig, kRes, cRes, qRes, iRes, mRes, logRes, tokRes] = await Promise.all([
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
  ]);

  for (const [label, r] of [["log", logRes], ["tokens", tokRes]] as const) {
    if (r.error) console.error(`[studio:settings] ${label} query failed:`, r.error.message);
  }

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าสตูดิโอ"
        description="น้ำเสียงแบรนด์ · แพลตฟอร์ม · สัดส่วน pillar · AI · กฎความเป็นส่วนตัว/การอนุมัติ · ข้อมูลตัวอย่าง · บันทึกการเรียก AI"
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

      {/* 8. Social connections */}
      <Section icon={<Link2Off className="h-4 w-4" />} title="การเชื่อมต่อโซเชียล" description="V1 ไม่มีการเผยแพร่อัตโนมัติ — ปุ่ม 'เผยแพร่' ในคอนเทนต์คือการทำเครื่องหมาย + ใส่ลิงก์เอง">
        <div className="space-y-2">
          {SOCIALS.map((s) => (
            <div key={s.key} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Link2Off className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">ยังไม่เชื่อมต่อ — จะมาใน V2</p>
                </div>
              </div>
              <Button size="sm" variant="outline" disabled>
                เชื่อมต่อ
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* 9. Demo data */}
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

      {/* 10. AI generation log */}
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
  icon,
  title,
  description,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
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
