"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setCheckinInterval } from "@/app/(dashboard)/cases/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  caseId: string;
  current: number | null; // minutes, or null = off
}

const OPTIONS = [
  { value: "off", label: "ปิด" },
  { value: "15", label: "ทุก 15 นาที" },
  { value: "30", label: "ทุก 30 นาที" },
  { value: "60", label: "ทุก 1 ชม." },
  { value: "120", label: "ทุก 2 ชม." },
  { value: "240", label: "ทุก 4 ชม." },
];

/**
 * Set the per-case agent check-in cadence. Admin/supervisor-gated server-side by
 * setCheckinInterval. Reverts the select on error.
 */
export function CheckinIntervalControl({ caseId, current }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(current ? String(current) : "off");
  const [pending, start] = useTransition();

  function change(next: string) {
    const prev = value;
    setValue(next); // optimistic
    start(async () => {
      const minutes = next === "off" ? null : Number(next);
      const res = await setCheckinInterval(caseId, minutes);
      if (res?.error) {
        setValue(prev); // revert
        toast.error(res.error);
        return;
      }
      toast.success(minutes ? `ตั้งรอบรายงานทุก ${minutes} นาที` : "ปิดรอบรายงานแล้ว");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <AlarmClock className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={change} disabled={pending}>
        <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="รอบรายงาน">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
