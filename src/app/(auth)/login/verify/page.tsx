import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { OtpVerifyForm } from "./otp-verify-form";

interface Props {
  searchParams: Promise<{ email?: string; next?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const t = await getTranslations("auth.verify");
  const { email = "", next = "/dashboard" } = await searchParams;

  // Decode in case the email was encoded in the URL.
  const decodedEmail = decodeURIComponent(email);

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {decodedEmail ? t("subtitleWithEmail", { email: decodedEmail }) : t("subtitle")}
      </p>

      <Suspense fallback={<div className="mt-8 h-40" />}>
        <OtpVerifyForm email={decodedEmail} next={next} />
      </Suspense>
    </div>
  );
}
