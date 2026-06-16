"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createCase } from "@/app/(dashboard)/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CasePriority, CaseStatus } from "@/lib/types";

const CASE_STATUSES: CaseStatus[] = ["new", "assigned", "active", "pending", "closed"];
const CASE_PRIORITIES: CasePriority[] = ["low", "medium", "high", "critical"];

export function CreateCaseDialog({ suggestedNumber }: { suggestedNumber: string }) {
  const t = useTranslations("cases.createDialog");
  const tStatus = useTranslations("status.case");
  const tPriority = useTranslations("status.priority");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await createCase(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.success"));
      setOpen(false);
      router.refresh();
      if (res?.id) router.push(`/cases/${res.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t("createButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.caseNumber")} name="case_number" defaultValue={suggestedNumber} required />
          <Field label={t("fields.clientName")} name="client_name" placeholder={t("fields.clientNamePlaceholder")} />
          <Field label={t("fields.caseType")} name="case_type" placeholder={t("fields.caseTypePlaceholder")} />
          <Field label={t("fields.targetName")} name="target_name" placeholder={t("fields.targetNamePlaceholder")} />
          <Field label={t("fields.targetPhone")} name="target_phone" type="tel" />
          <Field label={t("fields.targetVehicle")} name="target_vehicle" placeholder={t("fields.targetVehiclePlaceholder")} />
          <Field label={t("fields.licensePlate")} name="license_plate" placeholder={t("fields.licensePlatePlaceholder")} />
          <Field label={t("fields.targetAddress")} name="target_address" placeholder={t("fields.targetAddressPlaceholder")} />
          <Field label={t("fields.startDate")} name="start_date" type="date" />
          <Field label={t("fields.endDate")} name="end_date" type="date" />

          <div className="space-y-2">
            <Label htmlFor="status">{t("fields.status")}</Label>
            <Select name="status" defaultValue="new">
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_STATUSES.map((k) => (
                  <SelectItem key={k} value={k}>{tStatus(k)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">{t("fields.priority")}</Label>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_PRIORITIES.map((k) => (
                  <SelectItem key={k} value={k}>{tPriority(k)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">{t("fields.description")}</Label>
            <Textarea id="description" name="description" placeholder={t("fields.descriptionPlaceholder")} />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
