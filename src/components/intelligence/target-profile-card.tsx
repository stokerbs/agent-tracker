"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateTargetProfile } from "@/app/(dashboard)/cases/[id]/intelligence-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ProfileData {
  name: string | null;
  alias: string | null;
  phone: string | null;
  gender: string | null;
  age: number | null;
  notes: string | null;
}

interface Props {
  caseId: string;
  data: ProfileData;
  isStaff: boolean;
}

function Row({ label, value }: { label: string; value: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function TargetProfileCard({ caseId, data, isStaff }: Props) {
  const t = useTranslations("intelligence.profile");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [gender, setGender] = useState(data.gender ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("target_gender", gender);
    start(async () => {
      try {
        await updateTargetProfile(caseId, fd);
        toast.success(t("toast.success"));
        setOpen(false);
        router.refresh();
      } catch {
        toast.error(t("toast.error"));
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("editTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="target_alias">{t("alias")}</Label>
                  <Input id="target_alias" name="target_alias" defaultValue={data.alias ?? ""} placeholder={t("aliasPlaceholder")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("gender")}</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger><SelectValue placeholder={t("genderPlaceholder")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t("genderMale")}</SelectItem>
                        <SelectItem value="female">{t("genderFemale")}</SelectItem>
                        <SelectItem value="other">{t("genderOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="target_age">{t("age")}</Label>
                    <Input id="target_age" name="target_age" type="number" min="1" max="120" defaultValue={data.age ?? ""} placeholder="—" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="target_notes">{t("notes")}</Label>
                  <Textarea id="target_notes" name="target_notes" defaultValue={data.notes ?? ""} placeholder={t("notesPlaceholder")} rows={3} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("save")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label={t("name")} value={data.name} />
        <Row label={t("alias")} value={data.alias} />
        <Row label={t("phone")} value={data.phone} />
        <Row label={t("gender")} value={data.gender} />
        <Row label={t("age")} value={data.age} />
        {data.notes && (
          <div className="mt-2 rounded-md border border-border/50 bg-muted/30 p-2 text-xs text-muted-foreground">
            {data.notes}
          </div>
        )}
        {!data.name && !data.alias && !data.phone && !data.gender && !data.age && !data.notes && (
          <p className="text-xs text-muted-foreground">{t("empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
