import type { MarketingServicePage } from "./types";

/**
 * English service / info / location pages. Written for the foreign client's
 * actual questions (can I brief you from abroad, how do I pay, is it legal,
 * will the subject know, what do I receive). Same copy rules as th.ts.
 */
export const EN_SERVICE_PAGES: MarketingServicePage[] = [
  {
    lang: "en",
    slug: "cheating-spouse-investigator",
    kind: "service",
    service: "infidelity",
    title: "Infidelity Investigator Thailand — Cheating Partner Surveillance",
    description: "Discreet infidelity investigations across Thailand: lawful observation in public places, photo and video evidence with timestamps, written report. Free, confidential consultation.",
    h1: "Infidelity & Cheating Partner Investigations in Thailand",
    eyebrow: "Case File · Infidelity",
    intro: "When you need facts rather than suspicion, our investigators observe a partner's movements discreetly in public places, document what they see with photos, video and timestamps, and deliver a written report you can act on — whether you are in Thailand or briefing us from abroad.",
    sections: [
      {
        heading: "Signs clients report before they contact us",
        body: ["No single sign proves anything. Clients usually call when several of these happen together and the explanations keep changing — and when watching for themselves would risk being noticed and spoiling any evidence."],
        bullets: [
          "Irregular hours with vague or shifting reasons",
          "A phone that is suddenly guarded, re-locked or answered in another room",
          "More \"work trips\" or weekends away than before",
          "Unexplained spending or a change in appearance",
          "A partner living in Thailand while you are overseas and the stories don't add up",
        ],
      },
      {
        heading: "How we work — and what we never do",
        body: [
          "We start from what you know: routine, workplace, vehicle, the places they say they go. We plan lawful observation in public places with a team sized for the area. We never enter private premises, never place a tracker on someone else's vehicle, never install software on anyone's phone, and never approach or confront the subject.",
          "During the assignment you receive updates on the schedule we agree (WhatsApp works well across time zones). At the end you receive a written report with photos, video and a dated, timed, located timeline.",
        ],
      },
      {
        heading: "Using the evidence in a Thai or foreign divorce",
        body: ["Lawfully obtained photos, video and timelines can support divorce proceedings or a claim against a third party in Thailand, and are routinely used by foreign lawyers as part of a wider case. Admissibility is always for the court to decide, so we recommend involving a lawyer early; we format reports so your lawyer can use them directly."],
      },
      {
        heading: "Timeline and pricing",
        body: ["Most infidelity assignments run 3–7 days of observation, chosen around the subject's routine. Pricing depends on days, team size, location and complexity. You receive a written quote before anything starts, pay a 50 % deposit, and settle the balance before the report is released. See the pricing page for how quotes are built."],
      },
    ],
    deliverables: [
      "Photos and video of the subject's movements, taken in public places",
      "A timeline with dates, times and locations",
      "A written factual report, formatted for your lawyer if needed",
      "Progress updates on the schedule you choose (WhatsApp or email)",
      "A short recommendation on next steps",
    ],
    notOffered: [
      "Pulling another person's call logs, messages or phone location",
      "GPS trackers on someone else's vehicle or spyware on their devices",
      "Access to private residences, hotel, airline or bank records",
      "Contact, pressure or confrontation with the subject",
    ],
    faq: [
      { q: "Will my partner know they are being followed?", a: "We work discreetly in public places and never approach the subject. No assignment is entirely risk-free, so we tell you honestly where the risks are before we start." },
      { q: "I'm abroad — can you really take the case?", a: "Yes. Most of our international clients brief us on WhatsApp or email, pay by bank transfer, receive updates in their time zone and get the report electronically." },
      { q: "How long does it take?", a: "Typically 3–7 days of observation, planned around the subject's routine and your objective. Some cases resolve sooner; some require watching specific dates." },
      { q: "Can the evidence be used in court?", a: "Lawfully obtained evidence from public places can support a case in Thailand or elsewhere, but admissibility is for the court. Involve a lawyer early; we format reports accordingly." },
      { q: "How confidential is this?", a: "Client identity and findings are kept strictly confidential, delivered through the channel you choose and deleted on the schedule we agree." },
    ],
    related: ["investigate-partner-before-marriage", "evidence-for-adultery-lawsuit", "pricing", "private-investigator-bangkok"],
    caseType: "Cheating spouse",
    priceNote: "Written quote before we start · 50 % deposit",
    counterpart: { th: "นักสืบชู้สาว", zh: "relationship-investigation" },
  },
];
