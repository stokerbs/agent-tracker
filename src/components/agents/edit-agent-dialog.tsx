"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/lib/utils";
import type { Agent, AgentRole, AgentStatus, AgentVehicleType } from "@/lib/types";

const AGENT_STATUSES: AgentStatus[] = ["online", "moving", "idle", "offline", "emergency"];
const VEHICLE_TYPES: AgentVehicleType[] = ["car", "motorcycle", "foot"];
const AGENT_ROLES: AgentRole[] = ["field_agent", "supervisor", "team_leader", "operations"];

export function EditAgentDialog({ agent }: { agent: Agent }) {
  const t = useTranslations("agents.editDialog");
  const tStatus = useTranslations("status.agent");
  const tVehicle = useTranslations("agents.vehicleTypes");
  const tRole = useTranslations("agents.roleTypes");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [photoUrl, setPhotoUrl] = useState(agent.photo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${agent.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("agent-photos")
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("agent-photos").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Photo uploaded");
  }

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
          {/* Photo upload */}
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16">
                {photoUrl && <AvatarImage src={photoUrl} className="object-cover" />}
                <AvatarFallback className="text-lg font-semibold">
                  {initials(agent.full_name)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {uploading
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Camera className="h-3 w-3" />
                }
              </button>
            </div>
            <div>
              <p className="text-sm font-medium">{t("fields.photo")}</p>
              <p className="text-xs text-muted-foreground">{t("fields.photoHint")}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {uploading ? t("fields.photoUploading") : t("fields.photoChange")}
              </button>
            </div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {/* Submits the resolved URL via the form */}
            <input type="hidden" name="photo_url" value={photoUrl} />
          </div>

          <Field label={t("fields.fullName")} name="full_name" defaultValue={agent.full_name} required />
          <Field label={t("fields.nickname")} name="nickname" defaultValue={agent.nickname ?? ""} />
          <Field label={t("fields.position")} name="position" defaultValue={agent.position ?? ""} />
          <Field label={t("fields.area")} name="area" defaultValue={agent.area ?? ""} />
          <Field label={t("fields.phone")} name="phone" type="tel" defaultValue={agent.phone ?? ""} />
          <Field label={t("fields.email")} name="email" type="email" defaultValue={agent.email ?? ""} />
          <Field
            label={t("fields.userPhone")}
            name="user_phone"
            type="tel"
            defaultValue=""
            placeholder={t("fields.userPhonePlaceholder")}
          />

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="edit-agent-role">{t("fields.role")}</Label>
            <Select name="agent_role" defaultValue={agent.agent_role ?? "none"}>
              <SelectTrigger id="edit-agent-role">
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
            <Label htmlFor="edit-vehicle-type">{t("fields.vehicleType")}</Label>
            <Select name="vehicle_type" defaultValue={agent.vehicle_type ?? "none"}>
              <SelectTrigger id="edit-vehicle-type">
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || uploading}>
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
