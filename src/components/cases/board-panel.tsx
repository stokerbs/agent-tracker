"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ClipboardList, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  postCaseToBoard,
  removeCaseFromBoard,
  decideClaim,
  type PendingClaim,
} from "@/app/(dashboard)/cases/board-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  caseId: string;
  onBoard: boolean;
  slots: number | null;
  pendingClaims: PendingClaim[];
}

/** Admin panel on the case page: post a case to the job board and review claims. */
export function BoardPanel({ caseId, onBoard, slots, pendingClaims }: Props) {
  const t = useTranslations("board");
  const router = useRouter();
  const [slotInput, setSlotInput] = useState("3");
  const [pay, setPay] = useState("");
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [pending, start] = useTransition();

  function post() {
    start(async () => {
      const res = await postCaseToBoard(caseId, {
        slots: Number(slotInput),
        startAt: startAt || null,
        duration: duration || null,
        pay: pay ? Number(pay) : null,
        location: location || null,
      });
      if (res && "error" in res) { toast.error(res.error); return; }
      toast.success(t("posted"));
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const res = await removeCaseFromBoard(caseId);
      if (res && "error" in res) { toast.error(res.error); return; }
      toast.success(t("removed"));
      router.refresh();
    });
  }

  function decide(claimId: string, decision: "approved" | "rejected") {
    start(async () => {
      const res = await decideClaim(claimId, decision);
      if (res && "error" in res) { toast.error(res.error); return; }
      toast.success(decision === "approved" ? t("approved") : t("rejected"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!onBoard ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("slotsLabel")}</Label>
                <Input type="number" min={1} max={50} value={slotInput}
                  onChange={(e) => setSlotInput(e.target.value)} className="h-9" disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("payLabel")}</Label>
                <Input type="number" min={0} value={pay} placeholder="฿"
                  onChange={(e) => setPay(e.target.value)} className="h-9" disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("startLabel")}</Label>
                <Input type="datetime-local" value={startAt}
                  onChange={(e) => setStartAt(e.target.value)} className="h-9" disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("durationLabel")}</Label>
                <Input value={duration} placeholder={t("durationPlaceholder")}
                  onChange={(e) => setDuration(e.target.value)} className="h-9" disabled={pending} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("locationLabel")}</Label>
              <Input value={location} placeholder={t("locationPlaceholder")}
                onChange={(e) => setLocation(e.target.value)} className="h-9" disabled={pending} />
            </div>
            <Button onClick={post} disabled={pending} className="gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              {t("postButton")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{t("onBoard", { slots: slots ?? 0 })}</p>
              <Button variant="outline" size="sm" onClick={remove} disabled={pending}>
                {t("removeButton")}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("requests")} ({pendingClaims.length})
              </p>
              {pendingClaims.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noRequests")}</p>
              ) : (
                pendingClaims.map((cl) => (
                  <div
                    key={cl.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cl.agentName ?? t("unknownAgent")}</p>
                      {cl.note && <p className="truncate text-xs text-muted-foreground">{cl.note}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 gap-1 bg-success text-success-foreground hover:bg-success/90"
                        onClick={() => decide(cl.id, "approved")}
                        disabled={pending}
                      >
                        <Check className="h-3.5 w-3.5" /> {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-destructive"
                        onClick={() => decide(cl.id, "rejected")}
                        disabled={pending}
                      >
                        <X className="h-3.5 w-3.5" /> {t("reject")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
