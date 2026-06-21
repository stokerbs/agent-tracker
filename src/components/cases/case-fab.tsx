"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  activeTab: string;
  staff: boolean;
  canInsert: boolean;
}

function shouldShow(tab: string, staff: boolean, canInsert: boolean) {
  if (tab === "timeline") return canInsert;
  if (tab === "evidence") return true;
  if (tab === "expenses") return staff;
  return false;
}

export function CaseFAB({ activeTab, staff, canInsert }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visible = shouldShow(activeTab, staff, canInsert);

  function handleClick() {
    document.dispatchEvent(
      new CustomEvent("case:fab", { detail: { tab: activeTab } }),
    );
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence mode="popLayout">
      {visible && (
        <motion.button
          key={activeTab}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 450, damping: 28 }}
          onClick={handleClick}
          aria-label="Add"
          className={cn(
            "fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4 z-50",
            "flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
            "transition-transform active:scale-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "md:hidden",
          )}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>,
    document.body,
  );
}
