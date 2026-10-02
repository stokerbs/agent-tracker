"use client";

import { Printer } from "lucide-react";

/** Opens the browser print dialog (save as PDF). Client island; no data. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
