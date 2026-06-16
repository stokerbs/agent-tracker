"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UserSearchBar() {
  const t = useTranslations("users.search");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const current = params.get("q") ?? "";

  function submit(q: string) {
    start(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  function clear() {
    submit("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="relative flex-1 max-w-sm">
      <Search className={cn("absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground", pending && "animate-pulse")} />
      <Input
        ref={inputRef}
        defaultValue={current}
        placeholder={t("placeholder")}
        className="pl-8 pr-8 h-9"
        onChange={(e) => {
          const val = e.target.value;
          if (val === "" && current !== "") clear();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") clear();
        }}
      />
      {current && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-7 w-7"
          onClick={clear}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
