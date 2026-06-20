"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, Home, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  createLocation,
  updateLocation,
  deleteLocation,
} from "@/app/(dashboard)/cases/[id]/intelligence-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LocationType, TargetLocation } from "@/lib/types";

const LOCATION_ICONS: Record<LocationType, React.ReactNode> = {
  home:      <Home className="h-4 w-4 text-blue-500" />,
  workplace: <Briefcase className="h-4 w-4 text-amber-500" />,
  other:     <MapPin className="h-4 w-4 text-muted-foreground" />,
};

interface Props {
  caseId: string;
  locations: TargetLocation[];
  isStaff: boolean;
}

function LocationForm({
  location,
  caseId,
  onDone,
}: {
  location?: TargetLocation;
  caseId: string;
  onDone: () => void;
}) {
  const t = useTranslations("intelligence.locations");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locType, setLocType] = useState<LocationType>(location?.location_type ?? "other");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("location_type", locType);
    start(async () => {
      try {
        if (location) {
          await updateLocation(location.id, caseId, fd);
        } else {
          await createLocation(caseId, fd);
        }
        toast.success(location ? t("updateSuccess") : t("createSuccess"));
        onDone();
        router.refresh();
      } catch {
        toast.error(t("saveError"));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("type")}</Label>
        <Select value={locType} onValueChange={(v) => setLocType(v as LocationType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="home">{t("typeHome")}</SelectItem>
            <SelectItem value="workplace">{t("typeWorkplace")}</SelectItem>
            <SelectItem value="other">{t("typeOther")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {locType === "other" && (
        <div className="space-y-1.5">
          <Label htmlFor="label">{t("label")}</Label>
          <Input id="label" name="label" defaultValue={location?.label ?? ""} placeholder={t("labelPlaceholder")} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="address">{t("address")}</Label>
        <Input id="address" name="address" defaultValue={location?.address ?? ""} placeholder={t("addressPlaceholder")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lat">{t("lat")}</Label>
          <Input id="lat" name="lat" type="number" step="any" defaultValue={location?.lat ?? ""} placeholder="13.7563" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lng">{t("lng")}</Label>
          <Input id="lng" name="lng" type="number" step="any" defaultValue={location?.lng ?? ""} placeholder="100.5018" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" defaultValue={location?.notes ?? ""} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {location ? t("update") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function LocationsSection({ caseId, locations, isStaff }: Props) {
  const t = useTranslations("intelligence.locations");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<TargetLocation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TargetLocation | null>(null);

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      try {
        await deleteLocation(deleteTarget.id, caseId);
        toast.success(t("deleteSuccess"));
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error(t("deleteError"));
      }
    });
  }

  function mapsUrl(loc: TargetLocation): string | null {
    if (loc.lat && loc.lng) return `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
    if (loc.address) return `https://maps.google.com/?q=${encodeURIComponent(loc.address)}`;
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t("title")}</h4>
        {isStaff && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{t("addTitle")}</DialogTitle></DialogHeader>
              <LocationForm caseId={caseId} onDone={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {locations.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <MapPin className="mr-2 h-4 w-4" />
          <span className="text-xs">{t("empty")}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => {
            const mapUrl = mapsUrl(loc);
            const typeLabel = loc.location_type === "home"
              ? t("typeHome")
              : loc.location_type === "workplace"
              ? t("typeWorkplace")
              : (loc.label ?? t("typeOther"));

            return (
              <Card key={loc.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {LOCATION_ICONS[loc.location_type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                        {mapUrl && (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {t("openMaps")}
                          </a>
                        )}
                      </div>
                      {loc.address && (
                        <p className="mt-1 text-sm font-medium">{loc.address}</p>
                      )}
                      {loc.lat && loc.lng && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                        </p>
                      )}
                      {loc.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{loc.notes}</p>
                      )}
                    </div>
                    {isStaff && (
                      <div className="flex shrink-0 gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditLocation(loc)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteTarget(loc)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editLocation} onOpenChange={(o) => !o && setEditLocation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("editTitle")}</DialogTitle></DialogHeader>
          {editLocation && (
            <LocationForm location={editLocation} caseId={caseId} onDone={() => setEditLocation(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("deleteTitle")}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" /> {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
