"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  defaultName,
  defaultPhone,
  email,
}: {
  defaultName: string;
  defaultPhone: string;
  email: string;
}) {
  const t = useTranslations("profile");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await updateProfile(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.success"));
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="full_name">{t("fullNameLabel")}</Label>
        <Input id="full_name" name="full_name" defaultValue={defaultName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">{t("phoneLabel")}</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={defaultPhone} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("saveButton")}
      </Button>
    </form>
  );
}
