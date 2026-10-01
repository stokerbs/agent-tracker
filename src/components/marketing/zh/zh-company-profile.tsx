"use client";

import { Printer } from "lucide-react";

/** "下载 PDF" — the browser's print-to-PDF; no binary assets to maintain. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 print:hidden">
      <Printer className="h-4 w-4" /> 下载 PDF / 打印
    </button>
  );
}
