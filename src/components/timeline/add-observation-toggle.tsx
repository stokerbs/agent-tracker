"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ObservationUploader } from "@/components/timeline/observation-uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  caseId: string;
}

export function AddObservationToggle({ caseId }: Props) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: inline expand/collapse */}
      <div className="hidden sm:block">
        {desktopOpen ? (
          <ObservationUploader
            caseId={caseId}
            onSuccess={() => setDesktopOpen(false)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDesktopOpen(true)}
            className="gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Observation
          </Button>
        )}
      </div>

      {/* Mobile: floating action button + dialog */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Observation
        </button>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="max-w-sm gap-0 p-0">
            <DialogHeader className="px-4 pb-2 pt-4">
              <DialogTitle className="text-base">Add Observation</DialogTitle>
            </DialogHeader>
            <div className="px-4 pb-4">
              <ObservationUploader
                caseId={caseId}
                onSuccess={() => setMobileOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
