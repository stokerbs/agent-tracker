"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateCase } from "@/app/(dashboard)/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Case, CasePriority, CaseStatus } from "@/lib/types";

const STATUSES: CaseStatus[] = ["new", "assigned", "active", "pending", "closed"];
const PRIORITIES: CasePriority[] = ["low", "medium", "high", "critical"];

export function EditCaseDialog({ caseRecord }: { caseRecord: Case }) {
  const t = useTranslations("cases.editDialog");
  const tStatus = useTranslations("status.case");
  const tPriority = useTranslations("status.priority");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await updateCase(caseRecord.id, formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.success"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}{" "}
            <span className="font-mono text-primary">{caseRecord.case_number}</span>
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.clientName")} name="client_name"
            defaultValue={caseRecord.client_name ?? ""} />
          <Field label={t("fields.caseType")} name="case_type"
            defaultValue={caseRecord.case_type ?? ""}
            placeholder={t("fields.caseTypePlaceholder")} />
          <Field label={t("fields.startDate")} name="start_date" type="date"
            defaultValue={caseRecord.start_date ?? ""} />
          <Field label={t("fields.endDate")} name="end_date" type="date"
            defaultValue={caseRecord.end_date ?? ""} />

          <div className="space-y-2">
            <Label htmlFor="edit-status">{t("fields.status")}</Label>
            <Select name="status" defaultValue={caseRecord.status}>
              <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-priority">{t("fields.priority")}</Label>
            <Select name="priority" defaultValue={caseRecord.priority}>
              <SelectTrigger id="edit-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{tPriority(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-description">{t("fields.description")}</Label>
            <Textarea
              id="edit-description"
              name="description"
              defaultValue={caseRecord.description ?? ""}
              placeholder={t("fields.descriptionPlaceholder")}
              rows={3}
            />
          </div>

          <p className="sm:col-span-2 text-xs text-muted-foreground">
            {t("piiNote")}
          </p>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, name, ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`edit-case-${name}`}>{label}</Label>
      <Input id={`edit-case-${name}`} name={name} {...props} />
    </div>
  );
}
