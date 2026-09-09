"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Pillar } from "@/lib/studio/types";
import { Button } from "@/components/ui/button";
import { IdeaFormDialog } from "./idea-form-dialog";
import { SuggestIdeasDialog } from "./suggest-dialog";

/** Header actions: "เพิ่มไอเดียเอง" + "ให้ AI แนะนำ 5 ไอเดีย". Also reused by the empty state. */
export function IdeaToolbar({ aiAvailable, defaultPillar = null, variant = "header" }: { aiAvailable: boolean; defaultPillar?: Pillar | null; variant?: "header" | "empty" }) {
  const [addOpen, setAddOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const size = variant === "header" ? "sm" : "default";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size={size} onClick={() => setSuggestOpen(true)} disabled={!aiAvailable} title={aiAvailable ? undefined : "AI ยังใช้งานไม่ได้"}>
          <Sparkles className="mr-1.5 h-4 w-4 text-violet-500" /> ให้ AI แนะนำ 5 ไอเดีย
        </Button>
        <Button size={size} onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> เพิ่มไอเดียเอง
        </Button>
      </div>
      <IdeaFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <SuggestIdeasDialog open={suggestOpen} onOpenChange={setSuggestOpen} aiAvailable={aiAvailable} defaultPillar={defaultPillar} />
    </>
  );
}
