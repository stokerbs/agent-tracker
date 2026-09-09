import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Lightbulb, PieChart, Sparkles, Wand2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeUp } from "@/components/shared/motion";
import { AiUnavailableBanner } from "@/components/studio/ai-status";
import { ContentStatusBadge, PillarBadge, PlatformChip, ScoreStrip } from "@/components/studio/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { dayKeyInBangkok, formatThaiDayShort, timeInBangkok } from "./calendar/date-utils";
import { DirectorInput } from "./director-input";
import { MixPanel } from "./mix-panel";
import { PipelineTiles } from "./pipeline-tiles";
import { getStudioDashboardData } from "./queries";

export const metadata: Metadata = { title: "Creative Studio" };
export const dynamic = "force-dynamic";

function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour < 5) return "สวัสดีตอนดึก";
  if (hour < 12) return "สวัสดีตอนเช้า";
  if (hour < 17) return "สวัสดีตอนบ่าย";
  if (hour < 21) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนค่ำ";
}

export default async function StudioDashboardPage() {
  const profile = await requireRole(["admin"]);
  const data = await getStudioDashboardData();
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "คุณ";

  return (
    <div className="space-y-6">
      {/* 1 · Greeting + Creative Director brief */}
      <FadeUp>
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.06] p-6 md:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl">
            <p className="text-sm text-muted-foreground">
              {greeting()}, {firstName}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Detective Pulse ควรเผยแพร่อะไรต่อไป?</h1>
            <p className="mt-2 text-sm text-muted-foreground">บรีฟสั้น ๆ แล้วให้ Creative Director วางแผนแคมเปญจากความรู้จริงของทีม — ไอเดียจะไปรอที่ Idea Bank</p>
            <div className="mt-5">
              <DirectorInput aiAvailable={data.aiAvailable} />
            </div>
            {!data.aiAvailable && <AiUnavailableBanner className="mt-4" />}
          </div>
        </section>
      </FadeUp>

      {/* 2 · Pipeline */}
      <FadeUp delay={0.05}>
        <PipelineTiles counts={data.counts} />
      </FadeUp>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 3 · AI recommended ideas */}
        <FadeUp delay={0.08} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-violet-500" /> ไอเดียที่ AI แนะนำ
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/studio/ideas">
                  Idea Bank <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.aiIdeas.length === 0 ? (
                <EmptyState
                  icon={<Lightbulb className="h-6 w-6" />}
                  title="ยังไม่มีไอเดียใหม่จาก AI"
                  description="บรีฟ Creative Director ด้านบน หรือให้ AI แนะนำการปรับสัดส่วนคอนเทนต์ด้านล่าง"
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/studio/director">
                        <Wand2 className="h-3.5 w-3.5" /> เปิด Creative Director
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.aiIdeas.map((idea) => (
                    <Link
                      key={idea.id}
                      href="/studio/ideas"
                      className="group flex flex-col rounded-xl border border-border/60 bg-background/40 p-4 transition-all hover:border-border hover:bg-accent/40"
                    >
                      <PillarBadge pillar={idea.pillar} className="self-start" />
                      <p className="mt-2 text-sm font-medium leading-snug group-hover:text-foreground">{idea.title}</p>
                      {idea.hook && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">“{idea.hook}”</p>}
                      <div className="mt-3 flex-1" />
                      <ScoreStrip scores={idea.ai_scores} className="mt-2" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeUp>

        {/* 4 · Upcoming */}
        <FadeUp delay={0.11}>
          <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-primary" /> คอนเทนต์ที่กำลังจะถึง
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/studio/calendar">
                  ปฏิทิน <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="h-6 w-6" />}
                  title="ยังไม่มีคอนเทนต์ที่ตั้งเวลาไว้"
                  description="อนุมัติคอนเทนต์แล้วลากลงปฏิทินเพื่อกำหนดวันเผยแพร่"
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/studio/calendar">เปิดปฏิทิน</Link>
                    </Button>
                  }
                />
              ) : (
                data.upcoming.map((m) => {
                  const day = dayKeyInBangkok(m.scheduled_at);
                  return (
                    <Link
                      key={m.id}
                      href={`/studio/content/${m.id}`}
                      className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/40"
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-xs font-medium leading-none">{formatThaiDayShort(day)}</p>
                        <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">{timeInBangkok(m.scheduled_at)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <PillarBadge pillar={m.pillar} />
                          {m.primary_platform && <PlatformChip platform={m.primary_platform} short />}
                          <ContentStatusBadge status={m.status} />
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </FadeUp>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 5 · Content mix */}
        <FadeUp delay={0.14} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <PieChart className="h-4 w-4 text-primary" /> สัดส่วนคอนเทนต์
                <span className="text-xs font-normal text-muted-foreground">({data.mix.windowDays} วันล่าสุด + ที่ตั้งเวลาไว้ · {data.mix.total} ชิ้น)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MixPanel mix={data.mix} aiAvailable={data.aiAvailable} />
            </CardContent>
          </Card>
        </FadeUp>

        {/* 6 · Unused knowledge */}
        <FadeUp delay={0.17}>
          <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-sky-500" /> ความรู้ที่ยังไม่ถูกใช้
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/studio/knowledge">
                  คลังความรู้ <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.unusedKnowledge.totalApproved === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-6 w-6" />}
                  title="ยังไม่มีความรู้ที่อนุมัติให้ AI ใช้"
                  description="เพิ่มความรู้จริงของทีมและเปิด “ใช้กับ AI ได้” เพื่อให้คอนเทนต์อ้างอิงได้"
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/studio/knowledge/new">เพิ่มความรู้</Link>
                    </Button>
                  }
                />
              ) : (
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="font-mono text-3xl font-semibold tabular-nums">{data.unusedKnowledge.count}</p>
                    <p className="text-xs text-muted-foreground">จาก {data.unusedKnowledge.totalApproved} รายการที่อนุมัติ ยังไม่เคยถูกอ้างอิงในคอนเทนต์</p>
                  </div>
                  {data.unusedKnowledge.count === 0 ? (
                    <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                      ความรู้ทุกชิ้นถูกนำไปใช้แล้ว — เพิ่มความรู้ใหม่เพื่อให้ AI มีวัตถุดิบมากขึ้น
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-1.5">
                      {data.unusedKnowledge.examples.map((k) => (
                        <li key={k.id}>
                          <Link
                            href={`/studio/knowledge/${k.id}`}
                            className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs transition-colors hover:border-border hover:bg-accent/40"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                            <span className="truncate">{k.title}</span>
                          </Link>
                        </li>
                      ))}
                      {data.unusedKnowledge.count > 3 && (
                        <li className="pt-1 text-center text-[11px] text-muted-foreground">และอีก {data.unusedKnowledge.count - 3} รายการ</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeUp>
      </div>
    </div>
  );
}
