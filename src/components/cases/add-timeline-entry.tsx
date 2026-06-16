"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { addTimelineEntry } from "@/app/(dashboard)/timeline/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AddTimelineEntry({ caseId }: { caseId: string }) {
  const t = useTranslations("timeline.addEntry");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await addTimelineEntry(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.success"));
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="case_id" value={caseId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input name="entry_date" type="date" defaultValue={today} aria-label="Date" />
        <Input name="entry_time" type="time" defaultValue={time} aria-label="Time" />
        <Input
          name="location"
          placeholder={t("locationPlaceholder")}
          className="col-span-2"
          aria-label={t("locationPlaceholder")}
        />
      </div>
      <Textarea
        name="entry"
        placeholder={t("entryPlaceholder")}
        required
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("addButton")}
        </Button>
      </div>
    </form>
  );
}
