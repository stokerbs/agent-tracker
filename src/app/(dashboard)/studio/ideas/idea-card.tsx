"use client";

import { useState } from "react";
import { Archive, Bookmark, Clapperboard, Copy, Loader2, MoreHorizontal, Pencil, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import type { Idea } from "@/lib/studio/types";
import { FormatBadge, IdeaOriginBadge, IdeaStatusBadge, PillarBadge, PlatformChips, ScoreStrip } from "@/components/studio/badges";
import { SourceList } from "@/components/studio/source-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { duplicateIdea, setIdeaStatus } from "./actions";
import { GenerateContentDialog } from "./generate-dialog";
import { IdeaFormDialog } from "./idea-form-dialog";
import { useSafeTransition } from "@/components/studio/use-safe-transition";

type StatusTarget = "new" | "saved" | "rejected" | "archived";

export function IdeaCard({ idea, aiAvailable, campaignTitle }: { idea: Idea; aiAvailable: boolean; campaignTitle?: string | null }) {
  const [editOpen, setEditOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [pending, safe] = useSafeTransition();

  function changeStatus(status: StatusTarget, label: string) {
    safe(async () => {
      const res = await setIdeaStatus({ id: idea.id, status });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label}แล้ว`);
    });
  }

  function duplicate() {
    safe(async () => {
      const res = await duplicateIdea({ id: idea.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("ทำสำเนาแล้ว (สถานะ “ใหม่”)");
    });
  }

  const muted = idea.status === "rejected" || idea.status === "archived";
  const sources = idea.source_refs ?? [];
  const extraSources = Math.max(0, sources.length - 2);

  return (
    <>
      <Card className={cn("group relative flex flex-col border-border/60 transition-shadow hover:shadow-md", muted && "opacity-70", pending && "pointer-events-none opacity-60")}>
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <PillarBadge pillar={idea.pillar} />
              <FormatBadge format={idea.format} />
              <IdeaOriginBadge origin={idea.origin} />
              <IdeaStatusBadge status={idea.status} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0 text-muted-foreground" aria-label="การจัดการไอเดีย">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {idea.status !== "saved" && (
                  <DropdownMenuItem onClick={() => changeStatus("saved", "บันทึก")}>
                    <Bookmark className="mr-2 h-4 w-4" /> บันทึก
                  </DropdownMenuItem>
                )}
                {idea.status !== "new" && idea.status !== "generated" && (
                  <DropdownMenuItem onClick={() => changeStatus("new", "กลับเป็นใหม่")}>
                    <RotateCcw className="mr-2 h-4 w-4" /> กลับเป็นใหม่
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> แก้ไข
                </DropdownMenuItem>
                <DropdownMenuItem onClick={duplicate}>
                  <Copy className="mr-2 h-4 w-4" /> ทำสำเนา
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {idea.status !== "rejected" && (
                  <DropdownMenuItem onClick={() => changeStatus("rejected", "ปัดตก")}>
                    <XCircle className="mr-2 h-4 w-4" /> ปัดตก
                  </DropdownMenuItem>
                )}
                {idea.status !== "archived" && (
                  <DropdownMenuItem onClick={() => changeStatus("archived", "เก็บถาวร")}>
                    <Archive className="mr-2 h-4 w-4" /> เก็บถาวร
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="min-w-0">
            <h3 className="font-medium leading-snug">{idea.title}</h3>
            {idea.hook && <p className="mt-1 text-sm italic leading-relaxed text-muted-foreground">“{idea.hook}”</p>}
            {idea.description && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/70">{idea.description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <PlatformChips platforms={idea.platforms} max={4} />
            {idea.tags.slice(0, 4).map((t) => (
              <span key={t} className="text-[11px] text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>

          <ScoreStrip scores={idea.ai_scores} />

          {sources.length > 0 && (
            <div className="space-y-1.5">
              <SourceList items={sources.slice(0, 2)} />
              {extraSources > 0 && <p className="text-[11px] text-muted-foreground">+{extraSources} แหล่งอ้างอิง</p>}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <div className="min-w-0 text-[11px] text-muted-foreground">
              <span>{formatDate(idea.created_at)}</span>
              {campaignTitle && (
                <>
                  <span className="mx-1">·</span>
                  <span className="truncate">{campaignTitle}</span>
                </>
              )}
            </div>
            <Button size="sm" onClick={() => setGenOpen(true)} disabled={pending} className="shrink-0">
              <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
              {idea.status === "generated" ? "สร้างอีกชิ้น" : "สร้างคอนเทนต์"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <IdeaFormDialog open={editOpen} onOpenChange={setEditOpen} idea={idea} />
      <GenerateContentDialog open={genOpen} onOpenChange={setGenOpen} idea={idea} aiAvailable={aiAvailable} />
    </>
  );
}
