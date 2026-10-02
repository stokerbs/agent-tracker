import type { Metadata } from "next";
import { PrivacyNotice } from "@/components/marketing/privacy-notice";
import { getPrivacyNotice, PRIVACY_PATH } from "@/lib/marketing/privacy-notice";

const notice = getPrivacyNotice("zh");

export const metadata: Metadata = {
  title: notice.title,
  description: notice.description,
  alternates: {
    canonical: PRIVACY_PATH.zh,
    languages: { th: PRIVACY_PATH.th, en: PRIVACY_PATH.en, "zh-CN": PRIVACY_PATH.zh, "x-default": PRIVACY_PATH.en },
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPageZH() {
  return <PrivacyNotice notice={notice} />;
}
