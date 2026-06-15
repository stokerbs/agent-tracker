"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUserRole } from "@/app/(dashboard)/users/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_META } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

export function RoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onChange(value: string) {
    start(async () => {
      const res = await updateUserRole(userId, value as UserRole);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Role updated");
      router.refresh();
    });
  }

  return (
    <Select value={role} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(ROLE_META).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
