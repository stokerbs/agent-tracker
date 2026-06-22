"use client";

import { useMemo, useState } from "react";
import {
  User, Car, MapPin, Users, Clock, FileText, ImageIcon,
  Trash2, Plus, Loader2, CheckCircle2, ArrowLeft,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./confidence-badge";
import type {
  IntakeExtraction, IntakeImageKind, RelationKind,
} from "@/lib/types";

interface Props {
  initial: IntakeExtraction;
  /** filename -> object URL of the originally-uploaded file (for thumbnails) */
  thumbnails: Record<string, string>;
  submitting: boolean;
  onBack: () => void;
  onConfirm: (edited: IntakeExtraction) => void;
}

const RELATIONS: RelationKind[] = ["spouse", "partner", "friend", "associate", "family", "other"];
const IMAGE_KINDS: IntakeImageKind[] = ["target_photo", "vehicle_photo", "document", "screenshot", "location", "other"];
const LOC_TYPES = ["home", "workplace", "other"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SourceChips({ files }: { files: string[] }) {
  if (!files?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {files.map((f, i) => (
        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title="Source file">
          {f}
        </span>
      ))}
    </div>
  );
}

function ItemCard({
  children, onDelete, confidence,
}: { children: React.ReactNode; onDelete: () => void; confidence: number }) {
  return (
    <div className="relative rounded-lg border border-border/60 bg-card p-3">
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        <ConfidenceBadge value={confidence} />
        <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Section({
  icon, title, count, children, onAdd,
}: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
          <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{count}</span>
        </h3>
        {onAdd && (
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export function IntakeReview({ initial, thumbnails, submitting, onBack, onConfirm }: Props) {
  const t = useTranslations("cases.intake");
  const [d, setD] = useState<IntakeExtraction>(initial);

  // Generic immutable list helpers.
  function setList<K extends keyof IntakeExtraction>(key: K, list: IntakeExtraction[K]) {
    setD((prev) => ({ ...prev, [key]: list }));
  }
  function patchItem<K extends "targets" | "vehicles" | "locations" | "relationships" | "timeline">(
    key: K, i: number, patch: Partial<IntakeExtraction[K][number]>,
  ) {
    setD((prev) => {
      const arr = [...prev[key]];
      arr[i] = { ...arr[i], ...patch } as IntakeExtraction[K][number];
      return { ...prev, [key]: arr };
    });
  }
  function removeItem<K extends "targets" | "vehicles" | "locations" | "relationships" | "timeline">(key: K, i: number) {
    setD((prev) => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }));
  }

  const summary = useMemo(() => ([
    { label: t("targets"), n: d.targets.length },
    { label: t("vehicles"), n: d.vehicles.length },
    { label: t("locations"), n: d.locations.length },
    { label: t("relationships"), n: d.relationships.length },
    { label: t("timeline"), n: d.timeline.length },
    { label: t("documents"), n: d.documents.length + d.image_classifications.length },
  ]), [d, t]);

  const csv = (a: string[]) => a.join(", ");
  const fromCsv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="mb-2 text-sm font-semibold">{t("found")}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {summary.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold tabular-nums">{s.n}</span>
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Case */}
      <Section icon={<FileText className="h-4 w-4 text-muted-foreground" />} title={t("caseDetails")} count={1}>
        <div className="grid gap-3 rounded-lg border border-border/60 bg-card p-3 sm:grid-cols-2">
          <Field label={t("caseTitle")}>
            <Input value={d.case.suggested_title ?? ""} onChange={(e) => setD({ ...d, case: { ...d.case, suggested_title: e.target.value } })} />
          </Field>
          <Field label={t("caseType")}>
            <Input value={d.case.case_type ?? ""} onChange={(e) => setD({ ...d, case: { ...d.case, case_type: e.target.value } })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("summary")}>
              <Textarea rows={2} value={d.case.summary ?? ""} onChange={(e) => setD({ ...d, case: { ...d.case, summary: e.target.value } })} />
            </Field>
          </div>
        </div>
      </Section>

      {/* Targets */}
      <Section
        icon={<User className="h-4 w-4 text-cyan-500" />} title={t("targets")} count={d.targets.length}
        onAdd={() => setList("targets", [...d.targets, { full_name: "", nickname: null, gender: null, dob: null, age: null, nationality: null, occupation: null, phones: [], emails: [], socials: [], notes: null, confidence: 100, source_files: [] }])}
      >
        <div className="space-y-3">
          {d.targets.map((tg, i) => (
            <ItemCard key={i} confidence={tg.confidence} onDelete={() => removeItem("targets", i)}>
              <div className="grid gap-3 pr-16 sm:grid-cols-2">
                <Field label={t("fullName")}><Input value={tg.full_name ?? ""} onChange={(e) => patchItem("targets", i, { full_name: e.target.value })} /></Field>
                <Field label={t("nickname")}><Input value={tg.nickname ?? ""} onChange={(e) => patchItem("targets", i, { nickname: e.target.value })} /></Field>
                <Field label={t("gender")}>
                  <Select value={tg.gender ?? ""} onValueChange={(v) => patchItem("targets", i, { gender: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("male")}</SelectItem>
                      <SelectItem value="female">{t("female")}</SelectItem>
                      <SelectItem value="other">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("dob")}><Input type="date" value={tg.dob ?? ""} onChange={(e) => patchItem("targets", i, { dob: e.target.value })} /></Field>
                  <Field label={t("age")}><Input type="number" value={tg.age ?? ""} onChange={(e) => patchItem("targets", i, { age: e.target.value ? parseInt(e.target.value, 10) : null })} /></Field>
                </div>
                <Field label={t("nationality")}><Input value={tg.nationality ?? ""} onChange={(e) => patchItem("targets", i, { nationality: e.target.value })} /></Field>
                <Field label={t("occupation")}><Input value={tg.occupation ?? ""} onChange={(e) => patchItem("targets", i, { occupation: e.target.value })} /></Field>
                <Field label={t("phones")}><Input value={csv(tg.phones)} onChange={(e) => patchItem("targets", i, { phones: fromCsv(e.target.value) })} /></Field>
                <Field label={t("emails")}><Input value={csv(tg.emails)} onChange={(e) => patchItem("targets", i, { emails: fromCsv(e.target.value) })} /></Field>
                <div className="sm:col-span-2">
                  <Field label={t("socials")}>
                    <Input
                      value={tg.socials.map((s) => [s.platform, s.handle].filter(Boolean).join(":")).join(", ")}
                      placeholder="instagram:@handle, facebook:name"
                      onChange={(e) => patchItem("targets", i, {
                        socials: fromCsv(e.target.value).map((pair) => {
                          const [platform, ...rest] = pair.split(":");
                          return { platform: platform?.trim() || null, handle: rest.join(":").trim() || null };
                        }),
                      })}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t("notes")}><Textarea rows={2} value={tg.notes ?? ""} onChange={(e) => patchItem("targets", i, { notes: e.target.value })} /></Field>
                </div>
              </div>
              <SourceChips files={tg.source_files} />
            </ItemCard>
          ))}
          {d.targets.length === 0 && <p className="text-xs text-muted-foreground">{t("none")}</p>}
        </div>
      </Section>

      {/* Vehicles */}
      <Section
        icon={<Car className="h-4 w-4 text-amber-500" />} title={t("vehicles")} count={d.vehicles.length}
        onAdd={() => setList("vehicles", [...d.vehicles, { make: "", model: null, color: null, plate: null, is_primary: d.vehicles.length === 0, confidence: 100, source_files: [] }])}
      >
        <div className="space-y-3">
          {d.vehicles.map((v, i) => (
            <ItemCard key={i} confidence={v.confidence} onDelete={() => removeItem("vehicles", i)}>
              <div className="grid gap-3 pr-16 sm:grid-cols-4">
                <Field label={t("make")}><Input value={v.make ?? ""} onChange={(e) => patchItem("vehicles", i, { make: e.target.value })} /></Field>
                <Field label={t("model")}><Input value={v.model ?? ""} onChange={(e) => patchItem("vehicles", i, { model: e.target.value })} /></Field>
                <Field label={t("color")}><Input value={v.color ?? ""} onChange={(e) => patchItem("vehicles", i, { color: e.target.value })} /></Field>
                <Field label={t("plate")}><Input value={v.plate ?? ""} onChange={(e) => patchItem("vehicles", i, { plate: e.target.value })} /></Field>
              </div>
              <label className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={v.is_primary} onChange={(e) => patchItem("vehicles", i, { is_primary: e.target.checked })} />
                {t("primaryVehicle")}
              </label>
              <SourceChips files={v.source_files} />
            </ItemCard>
          ))}
          {d.vehicles.length === 0 && <p className="text-xs text-muted-foreground">{t("none")}</p>}
        </div>
      </Section>

      {/* Locations */}
      <Section
        icon={<MapPin className="h-4 w-4 text-rose-500" />} title={t("locations")} count={d.locations.length}
        onAdd={() => setList("locations", [...d.locations, { type: "other", label: "", address: null, notes: null, confidence: 100, source_files: [] }])}
      >
        <div className="space-y-3">
          {d.locations.map((l, i) => (
            <ItemCard key={i} confidence={l.confidence} onDelete={() => removeItem("locations", i)}>
              <div className="grid gap-3 pr-16 sm:grid-cols-3">
                <Field label={t("locType")}>
                  <Select value={l.type} onValueChange={(v) => patchItem("locations", i, { type: v as typeof l.type })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LOC_TYPES.map((lt) => <SelectItem key={lt} value={lt}>{t(`loc_${lt}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t("locLabel")}><Input value={l.label ?? ""} onChange={(e) => patchItem("locations", i, { label: e.target.value })} /></Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label={t("address")}><Input value={l.address ?? ""} onChange={(e) => patchItem("locations", i, { address: e.target.value })} /></Field>
                </div>
              </div>
              <SourceChips files={l.source_files} />
            </ItemCard>
          ))}
          {d.locations.length === 0 && <p className="text-xs text-muted-foreground">{t("none")}</p>}
        </div>
      </Section>

      {/* Relationships */}
      <Section
        icon={<Users className="h-4 w-4 text-violet-500" />} title={t("relationships")} count={d.relationships.length}
        onAdd={() => setList("relationships", [...d.relationships, { name: "", relation: "associate", notes: null, confidence: 100, source_files: [] }])}
      >
        <div className="space-y-3">
          {d.relationships.map((r, i) => (
            <ItemCard key={i} confidence={r.confidence} onDelete={() => removeItem("relationships", i)}>
              <div className="grid gap-3 pr-16 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label={t("name")}><Input value={r.name ?? ""} onChange={(e) => patchItem("relationships", i, { name: e.target.value })} /></Field>
                </div>
                <Field label={t("relation")}>
                  <Select value={r.relation} onValueChange={(v) => patchItem("relationships", i, { relation: v as RelationKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RELATIONS.map((rel) => <SelectItem key={rel} value={rel}>{t(`rel_${rel}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-3">
                  <Field label={t("notes")}><Input value={r.notes ?? ""} onChange={(e) => patchItem("relationships", i, { notes: e.target.value })} /></Field>
                </div>
              </div>
              <SourceChips files={r.source_files} />
            </ItemCard>
          ))}
          {d.relationships.length === 0 && <p className="text-xs text-muted-foreground">{t("none")}</p>}
        </div>
      </Section>

      {/* Timeline */}
      <Section
        icon={<Clock className="h-4 w-4 text-sky-500" />} title={t("timeline")} count={d.timeline.length}
        onAdd={() => setList("timeline", [...d.timeline, { date: null, time: null, entry: "", location: null, confidence: 100, source_files: [] }])}
      >
        <div className="space-y-3">
          {d.timeline.map((e, i) => (
            <ItemCard key={i} confidence={e.confidence} onDelete={() => removeItem("timeline", i)}>
              <div className="grid gap-3 pr-16 sm:grid-cols-4">
                <Field label={t("date")}><Input type="date" value={e.date ?? ""} onChange={(ev) => patchItem("timeline", i, { date: ev.target.value })} /></Field>
                <Field label={t("time")}><Input type="time" value={e.time ?? ""} onChange={(ev) => patchItem("timeline", i, { time: ev.target.value })} /></Field>
                <div className="sm:col-span-2">
                  <Field label={t("location")}><Input value={e.location ?? ""} onChange={(ev) => patchItem("timeline", i, { location: ev.target.value })} /></Field>
                </div>
                <div className="sm:col-span-4">
                  <Field label={t("event")}><Input value={e.entry} onChange={(ev) => patchItem("timeline", i, { entry: ev.target.value })} /></Field>
                </div>
              </div>
              <SourceChips files={e.source_files} />
            </ItemCard>
          ))}
          {d.timeline.length === 0 && <p className="text-xs text-muted-foreground">{t("none")}</p>}
        </div>
      </Section>

      {/* Files & classification */}
      <Section icon={<ImageIcon className="h-4 w-4 text-muted-foreground" />} title={t("files")} count={d.image_classifications.length}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.image_classifications.map((c, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-border/60 bg-card p-2">
              {thumbnails[c.file] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnails[c.file]} alt={c.file} className="h-16 w-16 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-[11px] text-muted-foreground" title={c.file}>{c.file}</p>
                <Select
                  value={c.kind}
                  onValueChange={(v) => {
                    const arr = [...d.image_classifications];
                    arr[i] = { ...arr[i], kind: v as IntakeImageKind };
                    setList("image_classifications", arr);
                  }}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMAGE_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`img_${k}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ConfidenceBadge value={c.confidence} />
              </div>
            </div>
          ))}
          {d.image_classifications.length === 0 && <p className="text-xs text-muted-foreground">{t("noImages")}</p>}
        </div>
      </Section>

      {/* Actions */}
      <div className={cn("sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur")}>
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("back")}
        </Button>
        <Button type="button" onClick={() => onConfirm(d)} disabled={submitting}>
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          {t("createCase")}
        </Button>
      </div>
    </div>
  );
}
