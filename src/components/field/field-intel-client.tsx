"use client";

import { useState } from "react";
import { Briefcase, Car, Download, Dumbbell, ExternalLink, File, FileImage, FileText, FileVideo, GraduationCap, Home, ImageIcon, MapPin, Navigation, Phone, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SocialLinks } from "@/components/intelligence/social-links";
import type { SocialMap } from "@/lib/socials";
import type { Evidence, LocationType, TargetLocation, TargetPhoto, TargetVehicle, VehiclePhoto } from "@/lib/types";

const LOCATION_ICONS: Record<LocationType, React.ReactNode> = {
  home:      <Home className="h-5 w-5 text-blue-500" />,
  workplace: <Briefcase className="h-5 w-5 text-amber-500" />,
  school:    <GraduationCap className="h-5 w-5 text-emerald-500" />,
  gym:       <Dumbbell className="h-5 w-5 text-violet-500" />,
  other:     <MapPin className="h-5 w-5 text-muted-foreground" />,
};

interface IntelDoc extends Evidence {
  signedUrl?: string;
}

interface ProfileData {
  name: string | null;
  alias: string | null;
  phone: string | null;
  gender: string | null;
  age: number | null;
  notes: string | null;
  socials: SocialMap;
}

interface Props {
  caseId: string;
  profile: ProfileData;
  photos: TargetPhoto[];
  vehicles: TargetVehicle[];
  vehiclePhotoMap?: Record<string, VehiclePhoto[]>;
  locations: TargetLocation[];
  documents?: IntelDoc[];
}

export function FieldIntelClient({ profile, photos, vehicles, vehiclePhotoMap = {}, locations, documents = [] }: Props) {
  const t = useTranslations("field.intel");
  const tI = useTranslations("intelligence");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const primary = photos.find((p) => p.is_primary) ?? photos[0] ?? null;
  const primaryVehicle = vehicles.find((v) => v.is_primary) ?? vehicles[0] ?? null;
  void primaryVehicle; // kept for type safety

  function getNavigateUrl(loc: TargetLocation): string | null {
    if (loc.maps_url) return loc.maps_url;
    if (loc.lat && loc.lng) return `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
    if (loc.address) return `https://maps.google.com/?q=${encodeURIComponent(loc.address)}`;
    return null;
  }

  function getTypeLabel(loc: TargetLocation): string {
    switch (loc.location_type) {
      case "home":      return tI("locations.typeHome");
      case "workplace": return tI("locations.typeWorkplace");
      case "school":    return tI("locations.typeSchool");
      case "gym":       return tI("locations.typeGym");
      default:          return tI("locations.typeOther");
    }
  }

  function getDisplayName(loc: TargetLocation): string | null {
    return loc.location_name || loc.label || loc.address || null;
  }

  function LocationCard({ loc }: { loc: TargetLocation }) {
    const navUrl = getNavigateUrl(loc);
    const displayName = getDisplayName(loc);
    const typeLabel = getTypeLabel(loc);

    return (
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {LOCATION_ICONS[loc.location_type] ?? LOCATION_ICONS.other}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {typeLabel}
            </p>
            {displayName && (
              <p className="mt-0.5 text-sm font-semibold leading-tight">{displayName}</p>
            )}
            {loc.lat && loc.lng && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
              </p>
            )}
            {loc.notes && (
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{loc.notes}</p>
            )}
          </div>
        </div>
        {navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:opacity-80"
          >
            <Navigation className="h-4 w-4" />
            {tI("locations.navigate")}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero: primary photo + quick-glance profile */}
      <Card className="overflow-hidden border-l-[3px] border-l-primary">
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
              <a href={`tel:${profile.phone}`} className="mt-1 flex items-center gap-1 font-mono text-xs text-primary">
                <Phone className="h-3 w-3" />
                {profile.phone}
              </a>
            )}
            {(profile.socials.facebook || profile.socials.instagram || profile.socials.tiktok) && (
              <SocialLinks socials={profile.socials} className="mt-1.5" />
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
            <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              {tI("photos.title")}
              <span className="ml-auto text-primary">{String(photos.length).padStart(2, "0")}</span>
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

      {/* Vehicles */}
      {vehicles.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <Car className="h-3.5 w-3.5" />
              {tI("vehicles.title")}
              <span className="ml-auto text-primary">{String(vehicles.length).padStart(2, "0")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-3">
            {vehicles.map((v) => {
              const vPhotos = vehiclePhotoMap[v.id] ?? [];
              const cover = vPhotos.find((p) => p.is_primary) ?? vPhotos[0] ?? null;
              const coverUrl = cover?.signedUrl || v.photoSignedUrl || null;
              return (
                <div key={v.id}>
                  <div className="flex gap-3">
                    {/* Cover photo */}
                    <div
                      className={cn(
                        "relative w-20 shrink-0 overflow-hidden rounded-lg bg-muted",
                        coverUrl && "cursor-pointer",
                      )}
                      style={{ minHeight: 64 }}
                      onClick={() => coverUrl && setLightbox(coverUrl)}
                    >
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverUrl} alt="Vehicle" className="h-full w-full object-cover" style={{ minHeight: 64 }} />
                      ) : (
                        <div className="flex h-full min-h-[64px] items-center justify-center">
                          <Car className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      {vPhotos.length > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-medium text-white">
                          <ImageIcon className="h-2 w-2" />
                          {vPhotos.length}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                      {v.is_primary && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">
                          {tI("vehicles.primary")}
                        </p>
                      )}
                      <p className="font-semibold text-sm leading-tight">
                        {[v.color, v.make, v.model].filter(Boolean).join(" ") || tI("vehicles.unknownVehicle")}
                      </p>
                      {v.licensePlate && (
                        <p className="font-mono text-sm font-bold text-primary">{v.licensePlate}</p>
                      )}
                      {v.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{v.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Additional photos strip (if >1) */}
                  {vPhotos.length > 1 && (
                    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                      {vPhotos.map((p) => (
                        <div
                          key={p.id}
                          className={cn(
                            "relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md border bg-muted",
                            p.is_primary && "ring-2 ring-primary ring-offset-1",
                          )}
                          onClick={() => p.signedUrl && setLightbox(p.signedUrl)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.signedUrl ?? ""} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Locations */}
      {locations.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {tI("locations.title")}
              <span className="ml-auto text-primary">{String(locations.length).padStart(2, "0")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {locations.map((loc) => <LocationCard key={loc.id} loc={loc} />)}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
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
