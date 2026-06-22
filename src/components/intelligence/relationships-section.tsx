"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RelationKind } from "@/lib/types";

export interface RelationshipView {
  id: string;
  name: string | null;
  relation: RelationKind;
  notes: string | null;
}

const RELATION_BADGE: Record<RelationKind, string> = {
  spouse: "bg-rose-500/15 text-rose-500",
  partner: "bg-pink-500/15 text-pink-500",
  friend: "bg-sky-500/15 text-sky-500",
  associate: "bg-amber-500/15 text-amber-500",
  family: "bg-violet-500/15 text-violet-500",
  other: "bg-muted text-muted-foreground",
};

export function RelationshipsSection({ relationships }: { relationships: RelationshipView[] }) {
  const t = useTranslations("intelligence.relationships");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t("title")}
          {relationships.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground">
              {relationships.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {relationships.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {relationships.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <Badge variant="secondary" className={RELATION_BADGE[r.relation]}>
                  {t(`relation.${r.relation}`)}
                </Badge>
                <div className="min-w-0">
                  <p className="font-medium">{r.name ?? "—"}</p>
                  {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
