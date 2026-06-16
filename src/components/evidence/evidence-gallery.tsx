"use client";

import { useState, useCallback } from "react";
import { EvidencePreview } from "./evidence-preview";
import { EvidenceLightbox } from "./evidence-lightbox";
import type { Evidence } from "@/lib/types";

interface Props {
  items: Evidence[];
  columns?: string;
}

export function EvidenceGallery({
  items,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
}: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const close = useCallback(() => setOpenIdx(null), []);
  const prev = useCallback(
    () => setOpenIdx((i) => (i !== null && i > 0 ? i - 1 : i)),
    [],
  );
  const next = useCallback(
    () => setOpenIdx((i) => (i !== null && i < items.length - 1 ? i + 1 : i)),
    [items.length],
  );

  return (
    <>
      <div className={`grid gap-3 ${columns}`}>
        {items.map((item, i) => (
          <EvidencePreview key={item.id} item={item} onOpen={() => setOpenIdx(i)} />
        ))}
      </div>

      {openIdx !== null && (
        <EvidenceLightbox
          items={items}
          index={openIdx}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
