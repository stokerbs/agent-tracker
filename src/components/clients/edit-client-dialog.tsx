"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateClient } from "@/app/(dashboard)/clients/actions";
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
import type { Client } from "@/lib/types";

export function EditClientDialog({ client }: { client: Client }) {
  const t = useTranslations("clients.detail.edit");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleSubmit(formData: FormData) {
    start(async () => {
      const res = await updateClient(client.id, formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("success"));
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

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("fields.name")}</Label>
            <Input
              id="name"
              name="name"
              defaultValue={client.name}
              placeholder={t("fields.namePlaceholder")}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company">{t("fields.company")}</Label>
            <Input
              id="company"
              name="company"
              defaultValue={client.company ?? ""}
              placeholder={t("fields.companyPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">{t("fields.address")}</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={client.address ?? ""}
              placeholder={t("fields.addressPlaceholder")}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("fields.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={client.email ?? ""}
                placeholder={t("fields.emailPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("fields.phone")}</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={client.phone ?? ""}
                placeholder={t("fields.phonePlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("fields.notes")}</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={client.notes ?? ""}
              placeholder={t("fields.notesPlaceholder")}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {tCommon("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
