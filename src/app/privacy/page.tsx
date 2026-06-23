import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Detective Pulse",
  description: "How the Detective Pulse Field Agent app collects, uses, and protects your data.",
};

const UPDATED = "23 June 2026";
const CONTACT_EMAIL = "privacy@detectivepulse.app";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * Public (unauthenticated) privacy policy — required for App Store / Play Store
 * submission and linked from the app. Whitelisted in middleware PUBLIC_PATHS.
 *
 * NOTE: this is a solid baseline; have it reviewed by counsel and confirm it
 * matches your actual data practices before publishing to the stores.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
        ← Detective Pulse
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-8">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Detective Pulse (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides an operations platform and a
          Field Agent mobile app for licensed private-investigation teams. This policy explains what
          we collect, why, and the choices you have. It applies to the Detective Pulse web app and
          the iOS/Android Field Agent app.
        </p>

        <Section title="Information we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Account &amp; profile</strong> — name, phone number, email, role, and avatar.</li>
            <li><strong>Location data</strong> — for field agents on duty, GPS position (including in the
              background while the app is active) used to show your position on the operations map. You
              control this through your device&rsquo;s location permission.</li>
            <li><strong>Photos &amp; evidence</strong> — images and files you capture or upload to a case.</li>
            <li><strong>Case intelligence</strong> — documents you upload may be processed by AI to extract
              structured case information that you review before it is saved.</li>
            <li><strong>Device &amp; push tokens</strong> — a push-notification token to deliver assignment,
              message, and emergency alerts.</li>
            <li><strong>Usage &amp; diagnostic data</strong> — basic logs needed to operate and secure the service.</li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <p>To operate the service: authenticate you, assign and manage cases, show agent locations to
            supervisors, store case evidence, deliver notifications, and keep the platform secure. We do
            not sell your personal information or use it for advertising.</p>
        </Section>

        <Section title="Sensitive personal data">
          <p>Identifying details (names, phone numbers, addresses) are encrypted at rest. Surveillance and
            case data are restricted by role and case assignment, so users only see records they are
            authorized to access.</p>
        </Section>

        <Section title="Service providers">
          <p>We share data only with infrastructure providers that process it on our behalf:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
            <li><strong>Vercel</strong> — application hosting.</li>
            <li><strong>Google Firebase</strong> — push-notification delivery.</li>
            <li><strong>Anthropic</strong> — AI processing of documents you submit to case intake.</li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>We keep your data while your account is active and as needed to provide the service or meet
            legal obligations. Location history is retained for a limited operational window and then
            deleted. When you delete your account, your login and personal profile data are removed; case
            records you contributed may be retained for the case owner&rsquo;s legal and business needs in a
            form no longer linked to your login.</p>
        </Section>

        <Section title="Your rights & account deletion">
          <p>You can access and update your profile in the app. You can <strong>delete your account at any
            time</strong> from <em>Settings → Profile → Delete account</em>; this permanently removes your
            login and personal profile data and unlinks you from the organization. To request a copy of
            your data or exercise other rights, contact us at the address below.</p>
        </Section>

        <Section title="Children">
          <p>Detective Pulse is a professional tool not intended for anyone under 18, and we do not
            knowingly collect data from children.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy; material changes will be reflected by the &ldquo;last updated&rdquo;
            date above.</p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>
      </div>
    </main>
  );
}
