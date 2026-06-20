"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase, CheckCircle, Dumbbell, ExternalLink, GraduationCap,
  Home, Loader2, MapPin, Navigation, Pencil, Plus, Trash2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  createLocation,
  updateLocation,
  deleteLocation,
  resolveGoogleMapsUrl,
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
import { cn } from "@/lib/utils";
import type { LocationType, TargetLocation } from "@/lib/types";

const LOCATION_ICONS: Record<LocationType, React.ReactNode> = {
  home:      <Home className="h-4 w-4 text-blue-500" />,
  workplace: <Briefcase className="h-4 w-4 text-amber-500" />,
  school:    <GraduationCap className="h-4 w-4 text-emerald-500" />,
  gym:       <Dumbbell className="h-4 w-4 text-violet-500" />,
  other:     <MapPin className="h-4 w-4 text-muted-foreground" />,
};

function parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

function isShortLink(url: string): boolean {
  return url.includes("goo.gl") || url.includes("maps.app");
}

interface Props {
  caseId: string;
  locations: TargetLocation[];
  isStaff: boolean;
}

// ── Location Form ─────────────────────────────────────────────────────────────

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
  const [urlInput, setUrlInput] = useState(location?.maps_url ?? "");
  const [resolving, setResolving] = useState(false);
  const [parsedLat, setParsedLat] = useState<number | null>(location?.lat ?? null);
  const [parsedLng, setParsedLng] = useState<number | null>(location?.lng ?? null);
  const [coordStatus, setCoordStatus] = useState<"idle" | "found" | "failed" | "resolving">(
    location?.lat && location?.lng ? "found" : "idle",
  );

  async function handleUrlChange(raw: string) {
    setUrlInput(raw);
    const url = raw.trim();

    if (!url) {
      setParsedLat(null);
      setParsedLng(null);
      setCoordStatus("idle");
      return;
    }

    // Try client-side regex first (works for full Google Maps URLs)
    const coords = parseGoogleMapsCoords(url);
    if (coords) {
      setParsedLat(coords.lat);
      setParsedLng(coords.lng);
      setCoordStatus("found");
      return;
    }

    // Short links need server-side resolution
    if (isShortLink(url)) {
      setCoordStatus("resolving");
      setResolving(true);
      try {
        const result = await resolveGoogleMapsUrl(url);
        if (result.lat !== null && result.lng !== null) {
          setParsedLat(result.lat);
          setParsedLng(result.lng);
          setCoordStatus("found");
        } else {
          setParsedLat(null);
          setParsedLng(null);
          setCoordStatus("failed");
        }
      } catch {
        setCoordStatus("failed");
      } finally {
        setResolving(false);
      }
      return;
    }

    // Unknown URL format — store URL but no coords
    setParsedLat(null);
    setParsedLng(null);
    setCoordStatus("failed");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("location_type", locType);
    fd.set("maps_url", urlInput.trim());
    fd.set("lat", parsedLat !== null ? String(parsedLat) : "");
    fd.set("lng", parsedLng !== null ? String(parsedLng) : "");
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
      {/* Location Name */}
      <div className="space-y-1.5">
        <Label htmlFor="location_name">{t("name")}</Label>
        <Input
          id="location_name"
          name="location_name"
          defaultValue={location?.location_name ?? location?.label ?? ""}
          placeholder={t("namePlaceholder")}
        />
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label>{t("type")}</Label>
        <Select value={locType} onValueChange={(v) => setLocType(v as LocationType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">{t("typeHome")}</SelectItem>
            <SelectItem value="workplace">{t("typeWorkplace")}</SelectItem>
            <SelectItem value="school">{t("typeSchool")}</SelectItem>
            <SelectItem value="gym">{t("typeGym")}</SelectItem>
            <SelectItem value="other">{t("typeOther")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Google Maps URL */}
      <div className="space-y-1.5">
        <Label htmlFor="maps_url">{t("mapsUrl")}</Label>
        <Input
          id="maps_url"
          value={urlInput}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={t("mapsUrlPlaceholder")}
          autoComplete="off"
          inputMode="url"
        />
        {/* Coordinate extraction status */}
        {urlInput.trim() && (
          <div className={cn(
            "flex items-center gap-1.5 text-xs",
            coordStatus === "found" && "text-emerald-600",
            coordStatus === "failed" && "text-muted-foreground",
            coordStatus === "resolving" && "text-muted-foreground",
          )}>
            {coordStatus === "resolving" && (
              <><Loader2 className="h-3 w-3 animate-spin" /> {t("coordsResolving")}</>
            )}
            {coordStatus === "found" && (
              <><CheckCircle className="h-3 w-3" /> {t("coordsFound", { lat: parsedLat?.toFixed(5), lng: parsedLng?.toFixed(5) })}</>
            )}
            {coordStatus === "failed" && (
              <><XCircle className="h-3 w-3" /> {t("coordsNotFound")}</>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={location?.notes ?? ""}
          placeholder={t("notesPlaceholder")}
          rows={2}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={pending || resolving}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {location ? t("update") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Locations Section ─────────────────────────────────────────────────────────

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

  function getNavigateUrl(loc: TargetLocation): string | null {
    if (loc.maps_url) return loc.maps_url;
    if (loc.lat && loc.lng) return `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
    if (loc.address) return `https://maps.google.com/?q=${encodeURIComponent(loc.address)}`;
    return null;
  }

  function getDisplayName(loc: TargetLocation): string | null {
    return loc.location_name || loc.label || loc.address || null;
  }

  function getTypeLabel(loc: TargetLocation): string {
    switch (loc.location_type) {
      case "home":      return t("typeHome");
      case "workplace": return t("typeWorkplace");
      case "school":    return t("typeSchool");
      case "gym":       return t("typeGym");
      default:          return t("typeOther");
    }
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
            const navUrl = getNavigateUrl(loc);
            const displayName = getDisplayName(loc);
            const typeLabel = getTypeLabel(loc);

            return (
              <Card key={loc.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {LOCATION_ICONS[loc.location_type] ?? LOCATION_ICONS.other}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                        {navUrl && (
                          <a
                            href={navUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {t("openMaps")}
                          </a>
                        )}
                      </div>
                      {displayName && (
                        <p className="mt-1 text-sm font-medium">{displayName}</p>
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
