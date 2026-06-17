"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createAgent } from "@/app/(dashboard)/agents/actions";
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
import type { AgentRole, AgentStatus, AgentVehicleType } from "@/lib/types";

const AGENT_STATUSES: AgentStatus[] = ["online", "moving", "idle", "offline", "emergency"];
const VEHICLE_TYPES: AgentVehicleType[] = ["car", "motorcycle", "foot"];
const AGENT_ROLES: AgentRole[] = ["field_agent", "supervisor", "team_leader", "operations"];

export function CreateAgentDialog() {
  const t = useTranslations("agents.createDialog");
  const tStatus = useTranslations("status.agent");
  const tVehicle = useTranslations("agents.vehicleTypes");
  const tRole = useTranslations("agents.roleTypes");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await createAgent(formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t("createButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.agentId")} name="agent_code" placeholder={t("fields.agentIdPlaceholder")} required />
          <Field label={t("fields.fullName")} name="full_name" placeholder={t("fields.fullNamePlaceholder")} required />
          <Field label={t("fields.nickname")} name="nickname" placeholder={t("fields.nicknamePlaceholder")} />
          <Field label={t("fields.position")} name="position" placeholder={t("fields.positionPlaceholder")} />
          <Field label={t("fields.phone")} name="phone" type="tel" placeholder={t("fields.phonePlaceholder")} />
          <Field label={t("fields.email")} name="email" type="email" placeholder={t("fields.emailPlaceholder")} />
          <Field label={t("fields.area")} name="area" placeholder={t("fields.areaPlaceholder")} />
          <Field label={t("fields.userPhone")} name="user_phone" type="tel" placeholder={t("fields.userPhonePlaceholder")} />

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="agent_role">{t("fields.role")}</Label>
            <Select name="agent_role" defaultValue="none">
              <SelectTrigger id="agent_role">
                <SelectValue placeholder={t("fields.roleNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("fields.roleNone")}</SelectItem>
                {AGENT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tRole(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Type */}
          <div className="space-y-2">
            <Label htmlFor="vehicle_type">{t("fields.vehicleType")}</Label>
            <Select name="vehicle_type" defaultValue="none">
              <SelectTrigger id="vehicle_type">
                <SelectValue placeholder={t("fields.vehicleTypeNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("fields.vehicleTypeNone")}</SelectItem>
                {VEHICLE_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {tVehicle(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="status">{t("fields.status")}</Label>
            <Select name="status" defaultValue="offline">
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_STATUSES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {tStatus(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input type="hidden" name="photo_url" value="" />
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
