"use client";

import { useState } from "react";
import { Clock, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ReportVersion } from "@/lib/types";

interface VersionHistoryPanelProps {
  versions: ReportVersion[];
  onRestoreVersion?: (content: ReportVersion["content"]) => void;
}

export function VersionHistoryPanel({ versions, onRestoreVersion }: VersionHistoryPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <Clock className="h-5 w-5 opacity-40" />
        <p>ยังไม่มีประวัติการแก้ไข</p>
        <p className="text-xs opacity-70">การบันทึกแต่ละครั้งจะสร้างเวอร์ชันใหม่</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {versions.map((v) => {
        const isOpen = expanded === v.id;
        return (
          <div key={v.id} className="rounded-md border border-border/60 bg-card">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : v.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold text-primary">
                  v{v.version_number}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatDate(v.created_at)}
                </span>
              </div>
              {onRestoreVersion && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestoreVersion(v.content);
                  }}
                  title="ใช้เวอร์ชันนี้"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </button>
            {isOpen && (
              <div className="border-t border-border/60 px-3 py-2 space-y-2">
                {v.content.executive_summary && (
                  <Section label="สรุปผล" text={v.content.executive_summary} />
                )}
                {v.content.body && (
                  <Section label="ลำดับเหตุการณ์" text={v.content.body} />
                )}
                {v.content.observations && (
                  <Section label="ข้อสังเกต" text={v.content.observations} />
                )}
                {v.content.conclusion && (
                  <Section label="สรุป" text={v.content.conclusion} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  const isHtml = text.trimStart().startsWith("<");
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {isHtml ? (
        <div
          className="report-content text-xs text-foreground/70 line-clamp-3"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      ) : (
        <p className="text-xs text-foreground/70 line-clamp-3 whitespace-pre-line">{text}</p>
      )}
    </div>
  );
}
