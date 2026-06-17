"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateAgent } from "@/app/(dashboard)/agents/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent, AgentStatus, AgentVehicleType } from "@/lib/types";

const AGENT_STATUSES: AgentStatus[] = [
  "available", "on_mission", "traveling", "break", "offline",
];

const VEHICLE_TYPES: AgentVehicleType[] = [
  "car", "motorcycle", "foot", "supervisor", "emergency",
];

export function EditAgentDialog({ agent }: { agent: Agent }) {
  const t = useTranslations("agents.editDialog");
  const tStatus = useTranslations("status.agent");
  const tVehicle = useTranslations("agents.vehicleTypes");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await updateAgent(agent.id, formData);
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
            <span className="font-mono text-primary">{agent.agent_code}</span>
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("fields.fullName")}
            name="full_name"
            defaultValue={agent.full_name}
            required
          />
          <Field
            label={t("fields.nickname")}
            name="nickname"
            defaultValue={agent.nickname ?? ""}
          />
          <Field
            label={t("fields.position")}
            name="position"
            defaultValue={agent.position ?? ""}
          />
          <Field
            label={t("fields.area")}
            name="area"
            defaultValue={agent.area ?? ""}
          />
          <Field
            label={t("fields.phone")}
            name="phone"
            type="tel"
            defaultValue={agent.phone ?? ""}
          />
          <Field
            label={t("fields.email")}
            name="email"
            type="email"
            defaultValue={agent.email ?? ""}
          />
          <Field
            label={t("fields.userPhone")}
            name="user_phone"
            type="tel"
            defaultValue=""
            placeholder={t("fields.userPhonePlaceholder")}
          />

          <div className="space-y-2">
            <Label htmlFor="edit-vehicle-type">{t("fields.vehicleType")}</Label>
            <Select name="vehicle_type" defaultValue={agent.vehicle_type ?? ""}>
              <SelectTrigger id="edit-vehicle-type">
                <SelectValue placeholder={t("fields.vehicleTypeNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("fields.vehicleTypeNone")}</SelectItem>
                {VEHICLE_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {tVehicle(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">{t("fields.status")}</Label>
            <Select name="status" defaultValue={agent.status}>
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
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
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`edit-${name}`}>{label}</Label>
      <Input id={`edit-${name}`} name={name} {...props} />
    </div>
  );
}
