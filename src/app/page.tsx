import Link from "next/link";
import {
  Activity,
  MapPin,
  ShieldCheck,
  FileText,
  Radio,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  {
    icon: MapPin,
    title: "Live GPS Tracking",
    desc: "Real-time field positions refreshed every 60 seconds with battery and status.",
  },
  {
    icon: Users,
    title: "Agent Management",
    desc: "Roster, availability board and field status across your whole team.",
  },
  {
    icon: FileText,
    title: "AI Report Generator",
    desc: "Turn raw timeline logs into a professional surveillance report in seconds.",
  },
  {
    icon: Radio,
    title: "Emergency SOS",
    desc: "One-tap distress alerts that instantly notify supervisors with location.",
  },
  {
    icon: Activity,
    title: "Operations Dashboard",
    desc: "Cases, missions, expenses and alerts unified into one command view.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    desc: "Row-level security, RBAC, audit logging and encrypted storage.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="h-5 w-5" />
          </div>
          <span>Detective Pulse</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <section className="py-20 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Operations Command Center
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Run every surveillance operation from one command center.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Detective Pulse unifies live agent tracking, case management,
            evidence, AI reporting and emergency response into a single
            secure, mobile-first platform.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Launch the platform</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t py-6 text-center text-sm text-muted-foreground">
        Detective Pulse Operations Command Center · Built for field teams
      </footer>
    </div>
  );
}
