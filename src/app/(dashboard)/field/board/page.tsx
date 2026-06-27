import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { listBoardCases } from "@/app/(dashboard)/cases/board-actions";
import { BoardClaimList } from "@/components/field/board-claim-list";

export const metadata: Metadata = { title: "Board" };
export const dynamic = "force-dynamic";

export default async function FieldBoardPage() {
  await requireProfile();
  const t = await getTranslations("board");
  const cases = await listBoardCases();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {t("availableTitle")}
        </span>
        <span className="font-mono text-[11px] text-primary">
          {String(cases.length).padStart(2, "0")}
        </span>
      </div>
      <BoardClaimList cases={cases} />
    </div>
  );
}
