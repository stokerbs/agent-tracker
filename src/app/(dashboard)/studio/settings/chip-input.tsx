"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Editable chip list: Enter / comma adds, ✕ or Backspace on empty input removes.
 * Values are trimmed and de-duplicated client-side; the server re-validates.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  max = 50,
  disabled,
  tone = "default",
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
  tone?: "default" | "destructive";
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...value, ...parts])).slice(0, max);
    onChange(next);
    setDraft("");
  }

  function remove(item: string) {
    onChange(value.filter((v) => v !== item));
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <span
              key={item}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
                tone === "destructive"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-border bg-muted/60 text-foreground",
              )}
            >
              {item}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={`ลบ ${item}`}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <Input
        value={draft}
        disabled={disabled || value.length >= max}
        placeholder={value.length >= max ? `ครบ ${max} รายการแล้ว` : placeholder ?? "พิมพ์แล้วกด Enter"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        className="h-9"
      />
    </div>
  );
}
