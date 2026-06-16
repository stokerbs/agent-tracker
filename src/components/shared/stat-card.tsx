"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
  hint?: string;
  trend?: { value: number; label?: string };
  accentBar?: "primary" | "success" | "warning" | "destructive";
}

export function StatCard({
  label,
  value,
  icon,
  accent = "text-primary",
  hint,
  accentBar,
}: StatCardProps) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-lg border border-border/60 bg-card p-5 transition-all duration-200 hover:border-border hover:shadow-sm"
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
    >
      {/* Accent bar */}
      {accentBar && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-0.5 rounded-t-lg",
            accentBar === "primary" && "bg-primary",
            accentBar === "success" && "bg-success",
            accentBar === "warning" && "bg-warning",
            accentBar === "destructive" && "bg-destructive",
          )}
        />
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            "bg-muted/60 transition-colors group-hover:bg-muted",
            accent,
          )}
        >
          {icon}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-2xl font-semibold leading-none tracking-tight">
            {value}
          </p>
          <p className="mt-1.5 truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          {hint && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground/60">{hint}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
