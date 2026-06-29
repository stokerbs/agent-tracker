import Link from "next/link";
import type { CSSProperties } from "react";
import {
  Radio, Search, Bell, LayoutDashboard, Navigation, Briefcase, Clock,
  FolderLock, FileText, Receipt, Wallet, type LucideIcon,
} from "lucide-react";

export interface MenuCard {
  icon: string;
  label: string;
  sub: string;
  accent: string; // a full color, e.g. "hsl(var(--primary))"
  href: string;
  active?: boolean;
}

export interface FieldHomeProps {
  initials: string;
  greeting: string;   // e.g. "สวัสดี, Alex"
  meta: string;       // e.g. "DP-006 · ภาคสนาม"
  statusLabel: string;
  ops: MenuCard[];
  field: MenuCard[];
}

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, radio: Radio, navigation: Navigation,
  briefcase: Briefcase, clock: Clock, "folder-lock": FolderLock,
  "file-text": FileText, receipt: Receipt, wallet: Wallet,
};

function Icon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  const C = ICONS[name];
  return C ? <C size={size} style={style} /> : null;
}

const tint = (c: string, p = 14) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const cardBase: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid color-mix(in srgb, hsl(var(--border)) 60%, transparent)",
  background: "linear-gradient(158deg, color-mix(in srgb, hsl(var(--card)) 90%, #fff 10%), hsl(var(--card)) 52%)",
  color: "hsl(var(--card-foreground))",
};
const hoverVars = (c: string) => ({ "--hover-accent": tint(c, 55), "--hover-glow": tint(c, 30) } as CSSProperties);
const iconWrap = (c: string, size = 46, r = 13): CSSProperties => ({
  width: size, height: size, borderRadius: r, display: "flex", alignItems: "center", justifyContent: "center",
  background: `linear-gradient(150deg, ${tint(c, 26)}, ${tint(c, 10)})`,
  color: c, boxShadow: `inset 0 0 0 1px ${tint(c, 32)}`, flexShrink: 0,
});

const eyebrow: CSSProperties = {
  margin: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: "color-mix(in srgb, hsl(var(--muted-foreground)) 80%, transparent)",
};
const iconBtn: CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: "1px solid color-mix(in srgb, hsl(var(--border)) 60%, transparent)",
  background: "hsl(var(--card))", color: "hsl(var(--foreground))", display: "flex",
  alignItems: "center", justifyContent: "center", flexShrink: 0,
};

function Tile(it: MenuCard) {
  return (
    <Link
      key={it.label}
      href={it.href}
      className="menu-card"
      style={{
        ...cardBase, ...hoverVars(it.accent), padding: "15px 6px 12px", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 9, textAlign: "center", position: "relative", textDecoration: "none",
        boxShadow: it.active ? `0 0 0 1px ${tint(it.accent, 45)}` : "none",
      }}
    >
      {it.active && <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: 9999, background: it.accent, boxShadow: `0 0 6px ${it.accent}` }} />}
      <span className="menu-icon" style={iconWrap(it.accent, 46, 13)}><Icon name={it.icon} size={22} /></span>
      <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.15 }}>{it.label}</span>
    </Link>
  );
}

export function FieldHome({ initials, greeting, meta, statusLabel, ops, field }: FieldHomeProps) {
  const all = [...ops, ...field];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "hsl(var(--foreground))" }}>
      {/* Brand lockup */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          position: "relative", width: 38, height: 38, flexShrink: 0, borderRadius: 11,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)",
          boxShadow: "inset 0 0 0 1px color-mix(in srgb, hsl(var(--primary)) 30%, transparent)", color: "hsl(var(--primary))",
        }}>
          <Icon name="radio" size={20} />
          <span style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 9999, background: "hsl(var(--success))", boxShadow: "0 0 0 2px hsl(var(--background))" }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ ...eyebrow, fontSize: 9, marginBottom: 2 }}>ศูนย์บัญชาการ</p>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Detective Pulse</p>
        </div>
        <Link href="/cases" aria-label="คดี" style={iconBtn}><Search size={17} /></Link>
        <Link href="/timeline" aria-label="ไทม์ไลน์" style={{ ...iconBtn, position: "relative" }}><Bell size={17} /></Link>
      </div>

      {/* Profile strip */}
      <div style={{ ...cardBase, padding: 14, display: "flex", alignItems: "center", gap: 13, boxShadow: "var(--glow-primary-lg)" }}>
        <div style={{
          width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
          background: "linear-gradient(150deg, color-mix(in srgb, hsl(var(--primary)) 28%, transparent), color-mix(in srgb, hsl(var(--primary)) 12%, transparent))",
          color: "hsl(var(--primary))", boxShadow: "inset 0 0 0 1px color-mix(in srgb, hsl(var(--primary)) 35%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)",
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{greeting}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>{meta}</p>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 9999,
          fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap",
          color: "hsl(var(--status-online))", background: tint("hsl(var(--status-online))", 15),
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: "hsl(var(--status-online))" }} /> {statusLabel}
        </span>
      </div>

      {/* Launcher grid */}
      <div>
        <p style={{ ...eyebrow, marginBottom: 12 }}>เมนูทั้งหมด</p>
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {all.map(Tile)}
        </div>
      </div>
    </div>
  );
}
