# Public SEO and article organization

The 2026-11-09 cleanup applies to the public Detective Pulse marketing website. It introduces no database writes, deletion, new publication approvals or new article URLs.

## Database article families

The old generator repeated eight topics. The reviewed ID map in `article-consolidation.ts` identifies nine secondary records and retains the earliest published guide as the primary in each family. At review time, **32 stored published articles become 23 primary guides** in TH/EN indexes, with 22 complete Chinese versions. Source records and all their original language bodies remain unchanged and readable at their existing URLs.

| Family | Primary English slug |
|---|---|
| Chiang Mai | `private-investigator-chiang-mai` |
| Background checks | `background-check-investigator` |
| Infidelity | `infidelity-private-investigator-evidence` |
| Bangkok | `private-detective-bangkok-professional` |
| Personal observation | `personal-surveillance-investigator` |
| Pricing factors | `private-investigator-cost-factors-pricing` |
| Hiring safely | `how-to-hire-private-investigator` |
| Online scams | `online-scam-fraud-investigator-recovery` |

Secondary URLs keep their original body and publication date, declare the primary URL as canonical, and offer a visible main-guide link. Their hreflang URLs reference the primary family's translations. They do not emit a competing BlogPosting identity. Canonical guides keep their own structured data. This organizes duplicates; it is not a substantive rewrite or legal verification of all previously approved copy.

Public queries select published fields explicitly, never `approve_token`, and share a request-local React cache. Lists, Chinese homepage cards, related articles, service recommendations and sitemap use the primary guides. Draft review and generation topic/slugs use their original separate helpers; all historic topics continue counting as used.

If a primary is unpublished/deleted, or lacks a translation already present on a secondary, the secondary remains visible and self-canonical. Similar titles alone never trigger merging; new articles require an explicit reviewed family entry if they genuinely duplicate an existing guide.

## Legacy WordPress pages

Twenty synonym/service-intent URLs declare the corresponding primary service/info page as canonical. Distinct supporting guides remain self-canonical. The complete map and permanent-redirect prerequisites are in `docs/seo-growth-audit/consolidation-redirects.md`.

Services, contact pages and secondary URLs are excluded from article cards. Homepage article rows highlight supporting guides rather than repeating service cards. Internal Markdown links preserve query parameters and anchors while pointing directly to primary service URLs; external/contact links retain their behavior.

Article hubs, privacy notices and careers pages each receive a single H1 through the shared heading component. Ordinary sections retain H2.

## Verification

Check all current sitemap entries for HTTP 200, one H1 and a self-canonical URL. Check all 20 legacy aliases and all 27 secondary article-language URLs for HTTP 200, the expected primary canonical, valid hreflang targets and a visible primary link. Check primary URLs for no secondary recommendations or duplicate title identities. Test aliases with percent-encoded Thai/Chinese paths. Permanent redirects remain gated off until the separate runbook checks are complete.

This work does not claim improved rankings or completed Search Console submission. Those require actual search-account data after Google recrawls the pages.
