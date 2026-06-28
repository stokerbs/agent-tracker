import {
  GPS903_BASE,
  FETCH_TIMEOUT,
  withTimeout,
  extractHiddenInput,
  extractAllCookies,
  hasAuthTicket,
} from "./client";

/**
 * POST Login.aspx using the IMEI No. tab.
 *
 * Live-confirmed form fields: txtImeiNo, txtImeiPassword, btnLoginImei
 *
 * Success/failure both return HTTP 200 — distinguish by .ASPXAUTH cookie:
 *   Success: ASP.NET_SessionId + .ASPXAUTH + Language cookies set
 *   Failure: only ASP.NET_SessionId set, no .ASPXAUTH
 *
 * Returns deduplicated Cookie header string or null on failure.
 */
export async function gps903Login(
  imei: string,
  devicePassword: string,
): Promise<string | null> {
  const loginUrl = `${GPS903_BASE}/Login.aspx?language=en-us`;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  console.log(`[GPS903] Login attempt — IMEI prefix: ${imei.slice(0, 6)}***`);

  // Step 1: GET login page to extract ASP.NET hidden form fields
  let html: string;
  let getRes: Response;
  try {
    getRes = await fetch(loginUrl, {
      headers:  { "User-Agent": ua },
      redirect: "manual",
      signal:   withTimeout(FETCH_TIMEOUT),
    });
    html = await getRes.text();
    console.log(`[GPS903] Login page GET — HTTP ${getRes.status}, ${html.length} bytes`);
  } catch (e) {
    console.error("[GPS903] Login page GET failed:", String(e));
    return null;
  }

  const viewState = extractHiddenInput(html, "__VIEWSTATE");
  if (!viewState) {
    console.error("[GPS903] Login aborted — could not extract __VIEWSTATE");
    return null;
  }

  const body = new URLSearchParams({
    __VIEWSTATE:          viewState,
    __VIEWSTATEGENERATOR: extractHiddenInput(html, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION:    extractHiddenInput(html, "__EVENTVALIDATION"),
    txtImeiNo:            imei,
    txtImeiPassword:      devicePassword,
    btnLoginImei:         "",
  });

  // Step 2: POST IMEI login form
  let postRes: Response;
  try {
    postRes = await fetch(loginUrl, {
      method:   "POST",
      headers:  {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":   ua,
      },
      body:     body.toString(),
      redirect: "manual",
      signal:   withTimeout(FETCH_TIMEOUT),
    });
    console.log(`[GPS903] Login POST — HTTP ${postRes.status}`);
  } catch (e) {
    console.error("[GPS903] Login POST failed:", String(e));
    return null;
  }

  // Step 3: Extract cookies — success = .ASPXAUTH present (HTTP status is 200 for both outcomes)
  const fullCookie = extractAllCookies(postRes);
  const names      = fullCookie?.split(";").map((c) => c.trim().split("=")[0]).join(", ") ?? "none";
  console.log(`[GPS903] Cookies received: ${names}`);

  if (!hasAuthTicket(fullCookie)) {
    console.error("[GPS903] Login failed — .ASPXAUTH not set (wrong IMEI or device password)");
    return null;
  }

  console.log("[GPS903] Login successful — .ASPXAUTH confirmed");
  return fullCookie!;
}
