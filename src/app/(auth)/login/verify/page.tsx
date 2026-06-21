import { Suspense } from "react";
import { OtpVerifyForm } from "./otp-verify-form";

interface Props {
  searchParams: Promise<{ phone?: string; next?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const { phone = "", next = "/dashboard" } = await searchParams;
  const decodedPhone = decodeURIComponent(phone);

  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted/30" />}>
      <OtpVerifyForm phone={decodedPhone} next={next} />
    </Suspense>
  );
}
