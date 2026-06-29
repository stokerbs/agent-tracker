"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClientRecord } from "@/app/(dashboard)/clients/actions";

export function CreateClientDialog() {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleSubmit(formData: FormData) {
    start(async () => {
      const res = await createClientRecord(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("createDialog.createdToast"));
      setOpen(false);
      if (res?.id) router.push(`/clients/${res.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("createDialog.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("createDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("createDialog.fullName")} *</Label>
            <Input id="name" name="name" placeholder="Eleanor Vance" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company">{t("createDialog.company")}</Label>
            <Input id="company" name="company" placeholder="Vance Enterprises" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">{t("createDialog.address")}</Label>
            <Textarea id="address" name="address" rows={2} placeholder="164 Bukit Merah Central, Singapore 150164" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("createDialog.email")}</Label>
              <Input id="email" name="email" type="email" placeholder="eleanor@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("createDialog.phone")}</Label>
              <Input id="phone" name="phone" placeholder="+66 81 234 5678" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("createDialog.notes")}</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Internal notes…" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("createDialog.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
