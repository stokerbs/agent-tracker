"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updateUserRole } from "@/app/(dashboard)/users/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["admin", "supervisor", "agent", "client"];

export function RoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const t = useTranslations("users.roles");
  const tUsers = useTranslations("users");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onChange(value: string) {
    start(async () => {
      const res = await updateUserRole(userId, value as UserRole);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(tUsers("roleUpdated"));
      router.refresh();
    });
  }

  return (
    <Select value={role} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((k) => (
          <SelectItem key={k} value={k}>
            {t(k)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
