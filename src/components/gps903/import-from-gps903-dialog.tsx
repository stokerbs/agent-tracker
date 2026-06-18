"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanSearch, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getGps903CatalogForImport,
  importDeviceToCase,
} from "@/app/(dashboard)/gps903-discovery/actions";
import type { Gps903Device } from "@/lib/types";

type CatalogItem = Pick<Gps903Device, "gps903_device_id" | "device_name" | "imei" | "model" | "last_seen">;

interface Props {
  caseId: string;
}

export function ImportFromGps903Dialog({ caseId }: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [catalog, setCatalog]   = useState<CatalogItem[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [selectedId, setSelected] = useState<number | null>(null);
  const [importing, start]      = useTransition();

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && catalog === null) {
      setLoading(true);
      try {
        const items = await getGps903CatalogForImport();
        setCatalog(items);
      } finally {
        setLoading(false);
      }
    }
  }

  const filtered = (catalog ?? []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(d.gps903_device_id).includes(q) ||
      (d.device_name?.toLowerCase().includes(q) ?? false) ||
      (d.imei?.toLowerCase().includes(q) ?? false)
    );
  });

  function handleImport() {
    if (selectedId === null) return;
    start(async () => {
      const res = await importDeviceToCase(selectedId, caseId, null);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("GPS903 device imported to this case");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ScanSearch className="h-4 w-4" />
          Import From GPS903
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import From GPS903</DialogTitle>
          <DialogDescription>
            Select a device from your GPS903 account to add to this case.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : catalog !== null && catalog.length === 0 ? (
          <div className="py-8 text-center">
            <ScanSearch className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No devices in catalog.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Go to GPS903 Discovery and run a Sync first.
            </p>
          </div>
        ) : catalog !== null ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, IMEI or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm"
                autoFocus
              />
            </div>

            <div className="max-h-[320px] overflow-auto rounded-md border">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No devices match</p>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.gps903_device_id}
                    type="button"
                    onClick={() => setSelected(d.gps903_device_id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 ${
                      selectedId === d.gps903_device_id
                        ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30"
                        : ""
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                      <span className="font-mono text-[10px] font-bold text-emerald-600">
                        {d.gps903_device_id}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {d.device_name ?? `Device ${d.gps903_device_id}`}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">{d.imei ?? "—"}</p>
                    </div>
                    {d.model && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{d.model}</Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={selectedId === null || importing}>
            {importing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Import Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
