"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PrivacyRules } from "@/lib/studio/types";
import { ChipInput } from "./chip-input";
import { ToggleRow } from "./knowledge-prefs-form";
import { updatePrivacyRules } from "./actions";

export function PrivacyRulesForm({ initial }: { initial: PrivacyRules }) {
  const [denylist, setDenylist] = useState<string[]>(initial.denylist);
  const [patternsText, setPatternsText] = useState(initial.custom_patterns.join("\n"));
  const [strict, setStrict] = useState(initial.strict_mode);
  const [pending, start] = useTransition();

  const patterns = useMemo(
    () =>
      patternsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [patternsText],
  );

  // Client-side hint only — the server re-compiles every pattern.
  const badPattern = useMemo(() => {
    for (const p of patterns) {
      try {
        new RegExp(p, "u");
      } catch {
        return p;
      }
    }
    return null;
  }, [patterns]);

  function save() {
    start(async () => {
      try {
        const res = await updatePrivacyRules({ denylist, custom_patterns: patterns, strict_mode: strict });
        if (res.ok) toast.success("บันทึกกฎความเป็นส่วนตัวแล้ว");
        else toast.error(res.error);
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>รายชื่อ/คำที่ห้ามเผยแพร่ (denylist)</Label>
        <p className="text-xs text-muted-foreground">ชื่อลูกค้า ชื่อเป้าหมาย ชื่อพนักงาน ชื่อบริษัทคู่กรณี — ตัวตรวจจะตั้งสถานะ blocked ทันทีเมื่อพบ</p>
        <ChipInput value={denylist} onChange={setDenylist} max={200} disabled={pending} tone="destructive" placeholder="เพิ่มชื่อ/คำ แล้วกด Enter" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="custom_patterns">Regex เพิ่มเติม (หนึ่งบรรทัดต่อหนึ่ง pattern)</Label>
        <p className="text-xs text-muted-foreground">
          เช่น <code className="rounded bg-muted px-1 py-0.5 text-[11px]">เคส\s?#?\d{"{4,}"}</code> · คอมไพล์ด้วย flag <code className="rounded bg-muted px-1 py-0.5 text-[11px]">u</code> — เซิร์ฟเวอร์จะปฏิเสธถ้า pattern ใดคอมไพล์ไม่ผ่าน
        </p>
        <Textarea
          id="custom_patterns"
          value={patternsText}
          onChange={(e) => setPatternsText(e.target.value)}
          rows={4}
          disabled={pending}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder={"บ้านเลขที่\\s?\\d+\nซอย\\s?\\S+"}
        />
        {badPattern && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" /> regex ไม่ถูกต้อง: <code className="font-mono">{badPattern}</code>
          </p>
        )}
      </div>

      <ToggleRow
        label="Strict mode"
        hint="ถือว่า review_required เป็น blocked — อนุมัติไม่ได้จนกว่าจะแก้เนื้อหาให้ผ่าน safe"
        checked={strict}
        onChange={setStrict}
        disabled={pending}
      />

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || badPattern !== null} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
