"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, ImageIcon, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  createVehicle,
  updateVehicle,
  uploadVehiclePhoto,
  deleteVehicle,
} from "@/app/(dashboard)/cases/[id]/intelligence-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TargetVehicle } from "@/lib/types";

interface Props {
  caseId: string;
  vehicles: TargetVehicle[];
  isStaff: boolean;
}

function VehicleForm({
  vehicle,
  caseId,
  onDone,
}: {
  vehicle?: TargetVehicle;
  caseId: string;
  onDone: () => void;
}) {
  const t = useTranslations("intelligence.vehicles");
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        if (vehicle) {
          await updateVehicle(vehicle.id, caseId, fd);
        } else {
          await createVehicle(caseId, fd);
        }
        toast.success(vehicle ? t("updateSuccess") : t("createSuccess"));
        onDone();
        router.refresh();
      } catch {
        toast.error(t("saveError"));
      }
    });
  }

  return (
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
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {vehicle ? t("update") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function VehiclesSection({ caseId, vehicles, isStaff }: Props) {
  const t = useTranslations("intelligence.vehicles");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<TargetVehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TargetVehicle | null>(null);
  const photoRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  function handlePhotoUpload(vehicleId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      try {
        await uploadVehiclePhoto(vehicleId, caseId, fd);
        toast.success(t("photoSuccess"));
        router.refresh();
      } catch {
        toast.error(t("photoError"));
      }
    });
    e.target.value = "";
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
          {vehicles.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className="flex">
                {/* Photo */}
                <div
                  className="relative w-24 shrink-0 cursor-pointer bg-muted"
                  onClick={() => isStaff && photoRefs.current[v.id]?.click()}
                >
                  {v.photoSignedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.photoSignedUrl} alt="Vehicle" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full min-h-[80px] items-center justify-center">
                      <Car className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  {isStaff && (
                    <>
                      <input
                        ref={(el) => { photoRefs.current[v.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(v.id, e)}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <ImageIcon className="h-5 w-5 text-white" />
                      </div>
                    </>
                  )}
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
                      <p className="font-medium text-sm leading-tight">
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
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editVehicle} onOpenChange={(o) => !o && setEditVehicle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("editTitle")}</DialogTitle></DialogHeader>
          {editVehicle && (
            <VehicleForm vehicle={editVehicle} caseId={caseId} onDone={() => setEditVehicle(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
          </DialogHeader>
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
