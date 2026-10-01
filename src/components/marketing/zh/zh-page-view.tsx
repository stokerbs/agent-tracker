"use client";

import { useEffect } from "react";
import { track } from "@/lib/marketing/analytics";

/** Fires one `zh_page_view` per page render with the service dimension. */
export function ZhPageView({ page, service, kind }: { page: string; service: string; kind: string }) {
  useEffect(() => {
    track({ event: "zh_page_view", page, service, kind });
  }, [page, service, kind]);
  return null;
}
