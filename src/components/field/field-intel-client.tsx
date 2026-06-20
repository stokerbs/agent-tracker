"use client";

import { useState } from "react";
import { Briefcase, Car, Download, ExternalLink, File, FileImage, FileText, FileVideo, Home, ImageIcon, MapPin, Paperclip, Phone, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Evidence, LocationType, TargetLocation, TargetPhoto, TargetVehicle } from "@/lib/types";

interface IntelDoc extends Evidence {
  signedUrl?: string;
}

const LOCATION_ICONS: Record<LocationType, React.ReactNode> = {
  home:      <Home className="h-4 w-4 text-blue-500" />,
  workplace: <Briefcase className="h-4 w-4 text-amber-500" />,
  other:     <MapPin className="h-4 w-4 text-muted-foreground" />,
};

interface ProfileData {
  name: string | null;
  alias: string | null;
  phone: string | null;
  gender: string | null;
  age: number | null;
  notes: string | null;
}

interface Props {
  caseId: string;
  profile: ProfileData;
  photos: TargetPhoto[];
  vehicles: TargetVehicle[];
  locations: TargetLocation[];
  documents?: IntelDoc[];
}

export function FieldIntelClient({ profile, photos, vehicles, locations, documents = [] }: Props) {
  const t = useTranslations("field.intel");
  const tI = useTranslations("intelligence");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const primary = photos.find((p) => p.is_primary) ?? photos[0] ?? null;
  const primaryVehicle = vehicles.find((v) => v.is_primary) ?? vehicles[0] ?? null;
  const home = locations.find((l) => l.location_type === "home");
  const workplace = locations.find((l) => l.location_type === "workplace");
  const others = locations.filter((l) => l.location_type === "other");

  function mapsUrl(loc: TargetLocation): string | null {
    if (loc.lat && loc.lng) return `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
    if (loc.address) return `https://maps.google.com/?q=${encodeURIComponent(loc.address)}`;
    return null;
  }

  function LocationChip({ loc }: { loc: TargetLocation }) {
    const url = mapsUrl(loc);
    const label = loc.location_type === "home"
      ? tI("locations.typeHome")
      : loc.location_type === "workplace"
      ? tI("locations.typeWorkplace")
      : (loc.label ?? tI("locations.typeOther"));

    const inner = (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5">
        {LOCATION_ICONS[loc.location_type]}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {loc.address && <p className="truncate text-sm font-medium">{loc.address}</p>}
          {!loc.address && loc.lat && loc.lng && (
            <p className="text-xs font-mono text-muted-foreground">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
          )}
          {loc.notes && <p className="text-xs text-muted-foreground mt-0.5">{loc.notes}</p>}
        </div>
        {url && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </div>
    );

    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
        {inner}
      </a>
    ) : (
      <div>{inner}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero: primary photo + quick-glance profile */}
      <Card className="overflow-hidden">
        <div className="flex gap-0">
          {/* Photo */}
          <div
            className={cn(
              "relative w-28 shrink-0 bg-muted",
              primary && "cursor-pointer",
            )}
            onClick={() => primary?.signedUrl && setLightbox(primary.signedUrl)}
          >
            {primary?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={primary.signedUrl} alt="Target" className="h-full min-h-[120px] w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[120px] items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Profile data */}
          <CardContent className="flex-1 p-3 space-y-1">
            <p className="font-semibold leading-tight">{profile.name ?? t("unknown")}</p>
            {profile.alias && <p className="text-xs text-muted-foreground">"{profile.alias}"</p>}
            <div className="flex flex-wrap gap-1 mt-1">
              {profile.gender && (
                <Badge variant="secondary" className="text-[10px] capitalize">{profile.gender}</Badge>
              )}
              {profile.age && (
                <Badge variant="secondary" className="text-[10px]">{t("age", { age: profile.age })}</Badge>
              )}
            </div>
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="flex items-center gap-1 text-xs text-primary mt-1">
                <Phone className="h-3 w-3" />
                {profile.phone}
              </a>
            )}
            {profile.notes && (
              <p className="mt-1 text-xs text-muted-foreground leading-snug">{profile.notes}</p>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Photo gallery */}
      {photos.length > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              {tI("photos.title")} ({photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-4 gap-1.5">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "aspect-square cursor-pointer overflow-hidden rounded border",
                    p.is_primary && "ring-2 ring-primary ring-offset-1",
                  )}
                  onClick={() => p.signedUrl && setLightbox(p.signedUrl)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.signedUrl ?? ""} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary vehicle highlight */}
      {primaryVehicle && (
        <Card>
          <CardContent className="p-0">
            <div className="flex">
              {primaryVehicle.photoSignedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryVehicle.photoSignedUrl}
                  alt="Vehicle"
                  className="w-24 shrink-0 object-cover rounded-l-lg cursor-pointer"
                  onClick={() => setLightbox(primaryVehicle.photoSignedUrl!)}
                />
              ) : (
                <div className="flex w-24 shrink-0 items-center justify-center bg-muted rounded-l-lg min-h-[72px]">
                  <Car className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {tI("vehicles.title")}
                  {primaryVehicle.is_primary && <span className="ml-1 text-primary">· {tI("vehicles.primary")}</span>}
                </p>
                <p className="font-semibold text-sm">
                  {[primaryVehicle.color, primaryVehicle.make, primaryVehicle.model].filter(Boolean).join(" ") || tI("vehicles.unknownVehicle")}
                </p>
                {primaryVehicle.licensePlate && (
                  <p className="font-mono text-base font-bold text-primary">{primaryVehicle.licensePlate}</p>
                )}
                {primaryVehicle.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">{primaryVehicle.notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All vehicles (if more than 1) */}
      {vehicles.length > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {tI("vehicles.title")} ({vehicles.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {vehicles.slice(1).map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-md border px-2.5 py-2">
                <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {[v.color, v.make, v.model].filter(Boolean).join(" ") || tI("vehicles.unknownVehicle")}
                  </p>
                  {v.licensePlate && <p className="font-mono text-xs font-bold text-primary">{v.licensePlate}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Locations */}
      {(home || workplace || others.length > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {tI("locations.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {home && <LocationChip loc={home} />}
            {workplace && <LocationChip loc={workplace} />}
            {others.map((loc) => <LocationChip key={loc.id} loc={loc} />)}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {tI("documents.fieldView", { count: documents.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 divide-y divide-border/50">
            {documents.map((doc) => {
              const mime = doc.mime_type ?? "";
              const Icon = mime.startsWith("image/")
                ? FileImage
                : mime === "application/pdf"
                ? FileText
                : mime.startsWith("video/")
                ? FileVideo
                : File;

              return (
                <div key={doc.id} className="flex items-center gap-3 py-2">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{doc.file_name ?? tI("documents.untitled")}</p>
                    {doc.notes && <p className="truncate text-xs text-muted-foreground">{doc.notes}</p>}
                  </div>
                  {doc.signedUrl && (
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.file_name ?? undefined}
                      className="shrink-0 text-primary"
                      title={tI("documents.download")}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Dialog open onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-sm p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-[80vh] w-full rounded object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
