import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { OtpVerifyForm } from "./otp-verify-form";

interface Props {
  searchParams: Promise<{ phone?: string; next?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const t = await getTranslations("auth.verify");
  const { phone = "", next = "/dashboard" } = await searchParams;

  const decodedPhone = decodeURIComponent(phone);

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {decodedPhone ? t("subtitleWithPhone", { phone: decodedPhone }) : t("subtitle")}
      </p>

      <Suspense fallback={<div className="mt-8 h-40" />}>
        <OtpVerifyForm phone={decodedPhone} next={next} />
      </Suspense>
    </div>
  );
}
