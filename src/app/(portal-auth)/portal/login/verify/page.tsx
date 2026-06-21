import { Suspense } from "react";
import { OtpVerifyForm } from "@/components/auth/otp-verify-form";

interface Props {
  searchParams: Promise<{ phone?: string }>;
}

export default async function PortalVerifyPage({ searchParams }: Props) {
  const { phone = "" } = await searchParams;
  const decodedPhone = decodeURIComponent(phone);

  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted/30" />}>
      <OtpVerifyForm
        phone={decodedPhone}
        next="/portal"
        resendHref="/portal/login"
      />
    </Suspense>
  );
}
