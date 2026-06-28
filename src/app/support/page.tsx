import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support · Detective Pulse",
  description:
    "Get help with the Detective Pulse Field Agent app — contact, FAQ, and account support.",
};

const UPDATED = "28 June 2026";
const SUPPORT_EMAIL = "detectivepluse@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">{q}</h3>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/**
 * Public (unauthenticated) support page — required by App Store guideline 1.5
 * (the Support URL must reach a functional page with help information) and
 * linked from App Store Connect. Whitelisted in middleware PUBLIC_PATHS.
 */
export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
        ← Detective Pulse
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Support</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-8">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Detective Pulse is an operations platform and Field Agent mobile app for licensed
          private-investigation teams. This page explains how to get help with your account and the
          app. If you need anything that isn&rsquo;t covered here, contact us directly — we&rsquo;re
          happy to help.
        </p>

        <Section title="Contact us">
          <p>
            Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            and we&rsquo;ll respond within 1–2 business days. Please include your name, the
            organization you work with, and a description of the issue (and a screenshot if you
            can).
          </p>
        </Section>

        <Section title="Getting started">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Detective Pulse accounts are provisioned by your organization&rsquo;s administrator.
              If you don&rsquo;t have login credentials yet, contact your administrator or email us.
            </li>
            <li>
              Sign in with the phone number registered to your account on the{" "}
              <Link href="/login" className="text-primary hover:underline">
                login screen
              </Link>
              .
            </li>
            <li>
              Field agents should allow location and notification permissions when prompted so the
              app can share your on-duty position and deliver assignment and emergency alerts.
            </li>
          </ul>
        </Section>

        <Section title="Frequently asked questions">
          <div className="space-y-4">
            <Faq q="I can't sign in.">
              Make sure you&rsquo;re using the phone number registered to your account. If you still
              can&rsquo;t get in, ask your organization administrator to confirm your account is
              active, or email {SUPPORT_EMAIL}.
            </Faq>
            <Faq q="Location isn't showing on the map.">
              Location sharing requires the device location permission to be enabled for Detective
              Pulse, and you must be on duty. Check your device Settings → Detective Pulse →
              Location and allow access while using the app (or always, for background tracking).
            </Faq>
            <Faq q="I'm not receiving notifications.">
              Enable notifications for Detective Pulse in your device Settings. Assignment, message,
              and emergency alerts are delivered as push notifications.
            </Faq>
            <Faq q="How do I delete my account?">
              You can delete your account at any time from <em>Settings → Profile → Delete
              account</em>. This permanently removes your login and personal profile data and
              unlinks you from the organization.
            </Faq>
          </div>
        </Section>

        <Section title="Privacy">
          <p>
            For how we collect, use, and protect your data, see our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
