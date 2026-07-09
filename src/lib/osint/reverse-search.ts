/**
 * Reverse-image-search launch links.
 *
 * We do NOT scrape these engines — we only build the URLs an investigator can
 * open in a new tab to run the search themselves. Engines that accept an image
 * URL as a query param get a pre-filled deep link; those that require an upload
 * get their landing page (the analyst drags the stored image in).
 */

import type { ReverseSearchLink } from "./types";

/**
 * Build launch links for the given (publicly reachable) image URL. When no URL
 * is available (e.g. a base64 upload with no origin), we still return the
 * engines' landing pages so the analyst can upload manually.
 */
export function buildReverseSearchLinks(imageUrl: string | null): ReverseSearchLink[] {
  const enc = imageUrl ? encodeURIComponent(imageUrl) : null;

  return [
    {
      engine: "google_lens",
      label: "Google Lens",
      url: enc ? `https://lens.google.com/uploadbyurl?url=${enc}` : "https://lens.google.com/",
    },
    {
      engine: "yandex",
      label: "Yandex Images",
      url: enc
        ? `https://yandex.com/images/search?rpt=imageview&url=${enc}`
        : "https://yandex.com/images/",
    },
    {
      engine: "bing",
      label: "Bing Visual Search",
      url: enc
        ? `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${enc}`
        : "https://www.bing.com/visualsearch",
    },
    {
      engine: "tineye",
      label: "TinEye",
      url: enc ? `https://tineye.com/search?url=${enc}` : "https://tineye.com/",
    },
    {
      // PimEyes is upload-only (face search) — always the landing page.
      engine: "pimeyes",
      label: "PimEyes",
      url: "https://pimeyes.com/en",
    },
  ];
}
