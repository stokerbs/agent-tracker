"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Car, ImageIcon, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  addVehiclePhoto,
  setPrimaryVehiclePhoto,
  deleteVehiclePhoto,
} from "@/app/(dashboard)/cases/[id]/intelligence-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TargetVehicle, VehiclePhoto } from "@/lib/types";

interface Props {
  caseId: string;
  vehicles: TargetVehicle[];
  vehiclePhotos: VehiclePhoto[];
  isStaff: boolean;
}

// ── Vehicle Form (Add / Edit) ─────────────────────────────────────────────────

function VehicleForm({
  vehicle,
  caseId,
  photos = [],
  onDone,
}: {
  vehicle?: TargetVehicle;
  caseId: string;
  photos?: VehiclePhoto[];
  onDone: () => void;
}) {
  const t = useTranslations("intelligence.vehicles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<VehiclePhoto | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const previews = files.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setPendingFiles((prev) => [...prev, ...previews]);
    e.target.value = "";
  }

  function removePending(idx: number) {
    setPendingFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function handleSetPrimary(photo: VehiclePhoto) {
    if (!vehicle) return;
    start(async () => {
      try {
        await setPrimaryVehiclePhoto(photo.id, vehicle.id, caseId, photo.storage_path);
        toast.success(t("photos.primarySet"));
        router.refresh();
      } catch {
        toast.error(t("photos.primaryError"));
      }
    });
  }

  function handleDeletePhoto() {
    if (!deletePhotoTarget || !vehicle) return;
    start(async () => {
      try {
        await deleteVehiclePhoto(deletePhotoTarget.id, vehicle.id, caseId, deletePhotoTarget.storage_path);
        toast.success(t("photos.deleteSuccess"));
        setDeletePhotoTarget(null);
        router.refresh();
      } catch {
        toast.error(t("photos.deleteError"));
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        let vehicleId: string;
        if (vehicle) {
          await updateVehicle(vehicle.id, caseId, fd);
          vehicleId = vehicle.id;
        } else {
          vehicleId = await createVehicle(caseId, fd);
        }
        for (const { file } of pendingFiles) {
          const pfd = new FormData();
          pfd.set("file", file);
          await addVehiclePhoto(vehicleId, caseId, pfd);
        }
        toast.success(vehicle ? t("updateSuccess") : t("createSuccess"));
        onDone();
        router.refresh();
      } catch {
        toast.error(t("saveError"));
      }
    });
  }

  const hasPhotos = photos.length > 0 || pendingFiles.length > 0;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="make">{t("make")}</Label>
            <Input id="make" name="make" defaultValue={vehicle?.make ?? ""} placeholder="Toyota" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">{t("model")}</Label>
            <Input id="model" name="model" defaultValue={vehicle?.model ?? ""} placeholder="Camry" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color">{t("color")}</Label>
            <Input id="color" name="color" defaultValue={vehicle?.color ?? ""} placeholder="Black" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="license_plate">{t("plate")}</Label>
            <Input id="license_plate" name="license_plate" defaultValue={vehicle?.licensePlate ?? ""} placeholder="กก 1234 กทม" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">{t("notes")}</Label>
          <Input id="notes" name="notes" defaultValue={vehicle?.notes ?? ""} placeholder={t("notesPlaceholder")} />
        </div>

        {/* ── Vehicle Photos ──────────────────────────────────────────── */}
        <div className="space-y-2.5">
          <Label>{t("photos.sectionLabel")}</Label>

          {/* Existing photos (edit mode) */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-md border bg-muted",
                    p.is_primary && "ring-2 ring-primary ring-offset-1",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.signedUrl ?? ""} alt="" className="h-full w-full object-cover" />
                  {p.is_primary && (
                    <span className="absolute left-1 top-1 rounded bg-primary/90 p-0.5">
                      <Star className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-end gap-0.5 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1 pt-3">
                    {!p.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(p)}
                        disabled={pending}
                        className="rounded bg-white/10 p-1 hover:bg-white/20 active:bg-white/30"
                        title={t("photos.setPrimary")}
                      >
                        <Star className="h-3 w-3 text-yellow-300" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeletePhotoTarget(p)}
                      disabled={pending}
                      className="rounded bg-white/10 p-1 hover:bg-red-500/60 active:bg-red-500/70"
                      title={t("photos.delete")}
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Staged file previews */}
          {pendingFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {pendingFiles.map(({ preview }, idx) => {
                const isFirstAndNoPrior = idx === 0 && photos.length === 0;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-md border bg-muted",
                      isFirstAndNoPrior && "ring-2 ring-primary ring-offset-1",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                    {isFirstAndNoPrior && (
                      <span className="absolute left-1 top-1 rounded bg-primary/90 px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
                        {t("photos.cover")}
                      </span>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-end bg-gradient-to-t from-black/70 to-transparent px-1 pb-1 pt-3">
                      <button
                        type="button"
                        onClick={() => removePending(idx)}
                        className="rounded bg-white/10 p-1 hover:bg-red-500/60 active:bg-red-500/70"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload buttons — large for mobile */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-col gap-1"
              disabled={pending}
              onClick={() => galleryRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" />
              <span className="text-xs">{t("photos.addFromGallery")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-col gap-1"
              disabled={pending}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">{t("photos.takePhoto")}</span>
            </Button>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>

          {!hasPhotos && (
            <p className="text-center text-xs text-muted-foreground">{t("photos.empty")}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {vehicle ? t("update") : t("create")}
          </Button>
        </DialogFooter>
      </form>

      {/* Delete existing photo confirm */}
      <Dialog open={!!deletePhotoTarget} onOpenChange={(o) => !o && setDeletePhotoTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("photos.deleteTitle")}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePhotoTarget(null)} disabled={pending}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeletePhoto} disabled={pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" /> {t("photos.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Vehicle Photo Gallery (card trigger) ─────────────────────────────────────

function VehicleGallery({
  vehicle,
  caseId,
  photos,
  isStaff,
}: {
  vehicle: TargetVehicle;
  caseId: string;
  photos: VehiclePhoto[];
  isStaff: boolean;
}) {
  const t = useTranslations("intelligence.vehicles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehiclePhoto | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);

  function uploadPhoto(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      try {
        await addVehiclePhoto(vehicle.id, caseId, fd);
        toast.success(t("photos.uploadSuccess"));
        router.refresh();
      } catch {
        toast.error(t("photos.uploadError"));
      }
    });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadPhoto(file);
    e.target.value = "";
  }

  function handleSetPrimary(photo: VehiclePhoto) {
    start(async () => {
      try {
        await setPrimaryVehiclePhoto(photo.id, vehicle.id, caseId, photo.storage_path);
        toast.success(t("photos.primarySet"));
        router.refresh();
      } catch {
        toast.error(t("photos.primaryError"));
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      try {
        await deleteVehiclePhoto(deleteTarget.id, vehicle.id, caseId, deleteTarget.storage_path);
        toast.success(t("photos.deleteSuccess"));
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error(t("photos.deleteError"));
      }
    });
  }

  const label = [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ") || t("unknownVehicle");
  const primaryPhoto = photos.find((p) => p.is_primary) ?? photos[0];

  return (
    <>
      {/* Trigger: tap the photo area on the vehicle card */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-full min-h-[88px] w-full flex-col items-center justify-center gap-1"
      >
        {primaryPhoto?.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primaryPhoto.signedUrl} alt="Vehicle" className="h-full w-full object-cover" />
        ) : (
          <>
            <Car className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-[9px] font-medium text-muted-foreground">
              {isStaff ? t("photos.addFromGallery") : t("photos.empty")}
            </span>
          </>
        )}
        {photos.length > 0 && (
          <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
            <ImageIcon className="h-2.5 w-2.5" />
            {photos.length}
          </span>
        )}
      </button>

      {/* Gallery Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{label}</DialogTitle>
          </DialogHeader>

          {photos.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              {t("photos.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-md border bg-muted",
                    p.is_primary && "ring-2 ring-primary ring-offset-1",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.signedUrl ?? ""}
                    alt=""
                    className="h-full w-full cursor-pointer object-cover"
                    onClick={() => setLightbox(p.signedUrl ?? null)}
                  />
                  {p.is_primary && (
                    <span className="absolute left-1 top-1 rounded bg-primary/90 p-0.5">
                      <Star className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  )}
                  {/* Always-visible action bar — works on mobile touch */}
                  {isStaff && (
                    <div className="absolute bottom-0 left-0 right-0 flex justify-end gap-0.5 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1 pt-3">
                      {!p.is_primary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(p)}
                          disabled={pending}
                          className="rounded bg-white/10 p-1 hover:bg-white/20 active:bg-white/30"
                          title={t("photos.setPrimary")}
                        >
                          <Star className="h-3 w-3 text-yellow-300" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        disabled={pending}
                        className="rounded bg-white/10 p-1 hover:bg-red-500/60 active:bg-red-500/70"
                        title={t("photos.delete")}
                      >
                        <Trash2 className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isStaff && (
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                disabled={pending}
                onClick={() => galleryRef.current?.click()}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {t("photos.addFromGallery")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                disabled={pending}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                {t("photos.takePhoto")}
              </Button>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("photos.deleteTitle")}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" /> {t("photos.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <Dialog open onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-sm p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-[80vh] w-full rounded object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ── Main VehiclesSection ──────────────────────────────────────────────────────

export function VehiclesSection({ caseId, vehicles, vehiclePhotos, isStaff }: Props) {
  const t = useTranslations("intelligence.vehicles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<TargetVehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TargetVehicle | null>(null);

  const photosByVehicle = vehiclePhotos.reduce<Record<string, VehiclePhoto[]>>((acc, p) => {
    if (!acc[p.vehicle_id]) acc[p.vehicle_id] = [];
    acc[p.vehicle_id].push(p);
    return acc;
  }, {});

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      try {
        await deleteVehicle(deleteTarget.id, caseId);
        toast.success(t("deleteSuccess"));
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error(t("deleteError"));
      }
    });
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
              <VehicleForm caseId={caseId} onDone={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <Car className="mr-2 h-4 w-4" />
          <span className="text-xs">{t("empty")}</span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((v) => {
            const photos = photosByVehicle[v.id] ?? [];
            return (
              <Card key={v.id} className="overflow-hidden">
                <div className="flex">
                  {/* Photo area — opens gallery */}
                  <div className="relative w-24 shrink-0 bg-muted">
                    <VehicleGallery
                      vehicle={v}
                      caseId={caseId}
                      photos={photos}
                      isStaff={isStaff}
                    />
                  </div>

                  {/* Info */}
                  <CardContent className="flex-1 p-3">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        {v.is_primary && (
                          <Badge variant="secondary" className="mb-1 text-[10px]">
                            <Star className="mr-0.5 h-2.5 w-2.5" /> {t("primary")}
                          </Badge>
                        )}
                        <p className="text-sm font-medium leading-tight">
                          {[v.color, v.make, v.model].filter(Boolean).join(" ") || t("unknownVehicle")}
                        </p>
                        {v.licensePlate && (
                          <p className="mt-0.5 font-mono text-xs font-bold text-primary">{v.licensePlate}</p>
                        )}
                        {v.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">{v.notes}</p>
                        )}
                      </div>
                      {isStaff && (
                        <div className="flex shrink-0 gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditVehicle(v)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteTarget(v)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog — passes existing photos for in-dialog management */}
      <Dialog open={!!editVehicle} onOpenChange={(o) => !o && setEditVehicle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("editTitle")}</DialogTitle></DialogHeader>
          {editVehicle && (
            <VehicleForm
              vehicle={editVehicle}
              caseId={caseId}
              photos={photosByVehicle[editVehicle.id] ?? []}
              onDone={() => setEditVehicle(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete vehicle confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("deleteTitle")}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>{tCommon("cancel")}</Button>
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
