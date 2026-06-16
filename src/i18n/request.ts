import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const LOCALES = ["en", "th"] as const;
type Locale = (typeof LOCALES)[number];

function isValidLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value ?? "th";
  const locale: Locale = isValidLocale(raw) ? raw : "th";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
