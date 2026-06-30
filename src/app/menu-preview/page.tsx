"use client";

/* Standalone design preview — Variation B ("ลอนช์เชอร์ 3 คอลัมน์") of the
 * Card Menu home screen imported from Claude Design (Detective Pulse — Card Menu).
 * Self-contained: pins the dark tactical palette locally so it renders identically
 * regardless of the app theme. Not wired into /field or navigation. */

import {
  Signal, Wifi, BatteryMedium, Radio, Search, Bell, LayoutDashboard, MapPin,
  Plus, Briefcase, Menu, Navigation, Clock, FolderLock, FileText, Receipt,
  Wallet, ChevronRight, type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

const ICONS: Record<string, LucideIcon> = {
  signal: Signal, wifi: Wifi, "battery-medium": BatteryMedium, radio: Radio,
  search: Search, bell: Bell, "layout-dashboard": LayoutDashboard, "map-pin": MapPin,
  plus: Plus, briefcase: Briefcase, menu: Menu, navigation: Navigation, clock: Clock,
  "folder-lock": FolderLock, "file-text": FileText, receipt: Receipt, wallet: Wallet,
  "chevron-right": ChevronRight,
};

function Icon({ name, size = 18, strokeWidth = 2, style }: {
  name: string; size?: number; strokeWidth?: number; style?: CSSProperties;
}) {
  const C = ICONS[name];
  return C ? <C size={size} strokeWidth={strokeWidth} style={style} /> : null;
}

function Eyebrow({ children, style = {} }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <p style={{
      margin: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
      letterSpacing: "0.16em", textTransform: "uppercase",
      color: "color-mix(in srgb, var(--muted-foreground) 80%, transparent)", ...style,
    }}>{children}</p>
  );
}

function StatusBar() {
  return (
    <div style={{
      height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 22px 0 26px", fontSize: 13, fontWeight: 600, color: "var(--foreground)", flexShrink: 0,
    }}>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>11:02</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="signal" size={15} /><Icon name="wifi" size={15} /><Icon name="battery-medium" size={17} />
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
  background: "var(--card)", color: "var(--foreground)", display: "flex",
  alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0,
};

function TopBar() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px 14px", flexShrink: 0 }}>
      <div style={{
        position: "relative", width: 38, height: 38, flexShrink: 0, borderRadius: 11,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "color-mix(in srgb, var(--primary) 12%, transparent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--primary) 30%, transparent)", color: "var(--primary)",
      }}>
        <Icon name="radio" size={20} />
        <span style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 9999, background: "var(--success)", boxShadow: "0 0 0 2px var(--background)" }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Eyebrow style={{ fontSize: 9, marginBottom: 2 }}>ศูนย์บัญชาการ</Eyebrow>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Detective Pulse</p>
      </div>
      <div style={iconBtn}><Icon name="search" size={17} /></div>
      <div style={{ ...iconBtn, position: "relative" }}>
        <Icon name="bell" size={17} />
        <span style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: 9999, background: "var(--prio-high)", boxShadow: "0 0 0 2px var(--card)" }} />
      </div>
    </div>
  );
}

function TabBar({ active = "home" }: { active?: string }) {
  const tabs = [
    { k: "home", icon: "layout-dashboard", label: "หน้าแรก", fab: false },
    { k: "map", icon: "map-pin", label: "แผนที่", fab: false },
    { k: "add", icon: "plus", label: "", fab: true },
    { k: "cases", icon: "briefcase", label: "คดี", fab: false },
    { k: "more", icon: "menu", label: "เมนู", fab: false },
  ];
  return (
    <div style={{
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-around",
      padding: "8px 8px 12px",
      borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
      background: "color-mix(in srgb, var(--background) 85%, transparent)", backdropFilter: "blur(12px)",
    }}>
      {tabs.map((t) => t.fab ? (
        <div key={t.k} style={{
          width: 46, height: 46, borderRadius: 14, marginTop: -18,
          background: "var(--primary)", color: "var(--primary-foreground)", display: "flex",
          alignItems: "center", justifyContent: "center", boxShadow: "var(--glow-primary), var(--shadow-md)",
        }}>
          <Icon name={t.icon} size={24} strokeWidth={2.5} />
        </div>
      ) : (
        <div key={t.k} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0",
          color: active === t.k ? "var(--primary)" : "var(--muted-foreground)",
        }}>
          <Icon name={t.icon} size={21} strokeWidth={active === t.k ? 2.4 : 2} />
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

interface NavItem { icon: string; label: string; sub: string; accent: string; active?: boolean }

const OPS: NavItem[] = [
  { icon: "layout-dashboard", label: "แดชบอร์ด", sub: "ภาพรวมวันนี้", accent: "var(--primary)" },
  { icon: "radio", label: "แอปภาคสนาม", sub: "กำลังใช้งาน", accent: "var(--primary)", active: true },
  { icon: "navigation", label: "ติดตาม GPS", sub: "5 หน่วยออนไลน์", accent: "var(--status-moving)" },
  { icon: "briefcase", label: "คดี", sub: "3 คดีเปิด", accent: "var(--prio-high)" },
  { icon: "clock", label: "ไทม์ไลน์", sub: "12 เหตุการณ์", accent: "var(--prio-medium)" },
];
const FIELD: NavItem[] = [
  { icon: "folder-lock", label: "หลักฐาน", sub: "312 ไฟล์", accent: "var(--prio-medium)" },
  { icon: "file-text", label: "รายงาน", sub: "ร่าง 4 ฉบับ", accent: "var(--primary)" },
  { icon: "receipt", label: "ค่าใช้จ่าย", sub: "฿8,240", accent: "var(--success)" },
  { icon: "wallet", label: "เงินเดือน", sub: "รอบ ก.ค.", accent: "var(--status-online)" },
];

const tint = (c: string, p = 14) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const cardBase: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
  background: "linear-gradient(158deg, color-mix(in srgb, var(--card) 90%, #fff 10%), var(--card) 52%)",
  color: "var(--card-foreground)",
};
const hoverVars = (c: string) => ({ "--hover-accent": tint(c, 55), "--hover-glow": tint(c, 30) } as CSSProperties);
const iconWrap = (c: string, size = 46, r = 13): CSSProperties => ({
  width: size, height: size, borderRadius: r, display: "flex", alignItems: "center", justifyContent: "center",
  background: `linear-gradient(150deg, ${tint(c, 26)}, ${tint(c, 10)})`,
  color: c, boxShadow: `inset 0 0 0 1px ${tint(c, 32)}`, flexShrink: 0,
});

function ProfileStrip() {
  return (
    <div style={{ ...cardBase, padding: 14, display: "flex", alignItems: "center", gap: 13, boxShadow: "var(--glow-primary-lg)" }}>
      <div style={{
        width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
        background: "linear-gradient(150deg, color-mix(in srgb, var(--primary) 28%, transparent), color-mix(in srgb, var(--primary) 12%, transparent))",
        color: "var(--primary)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)",
      }}>AC</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>สวัสดี, Alex</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>DP-006 · ภาคสนาม</p>
      </div>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 9999,
        fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
        color: "var(--status-online)", background: tint("var(--status-online)", 15),
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 9999, background: "var(--status-online)" }} /> ปฏิบัติงาน
      </span>
    </div>
  );
}

function SysFooter() {
  return (
    <div style={{
      flexShrink: 0, display: "flex", alignItems: "center", gap: 9, padding: "9px 18px",
      borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
      fontSize: 11.5, color: "var(--muted-foreground)",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 9999, background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
      ระบบทำงานปกติ
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative", background: "var(--background)", color: "var(--foreground)" }}>
      <StatusBar />
      <TopBar />
      <div className="dp-scrollbar-thin" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {children}
      </div>
      <SysFooter />
      <TabBar active="home" />
    </div>
  );
}

/* Variation B — 3-col compact launcher */
function HomeLauncher() {
  const all = [...OPS, ...FIELD];
  return (
    <Shell>
      <div style={{ padding: "0 16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <ProfileStrip />
        <div>
          <Eyebrow style={{ marginBottom: 12 }}>เมนูทั้งหมด</Eyebrow>
          <div className="stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {all.map((it) => (
              <div key={it.label} className="menu-card" style={{
                ...cardBase, ...hoverVars(it.accent), padding: "15px 6px 12px", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 9, cursor: "pointer", textAlign: "center", position: "relative",
                boxShadow: it.active ? `0 0 0 1px ${tint(it.accent, 45)}` : "none",
              }}>
                {it.active && <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: 9999, background: it.accent, boxShadow: `0 0 6px ${it.accent}` }} />}
                <span className="menu-icon" style={iconWrap(it.accent, 46, 13)}><Icon name={it.icon} size={22} /></span>
                <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.15 }}>{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

const PALETTE: CSSProperties = {
  "--background": "hsl(222 47% 6%)",
  "--card": "hsl(220 39% 11%)",
  "--card-foreground": "hsl(213 35% 92%)",
  "--foreground": "hsl(213 35% 92%)",
  "--muted-foreground": "hsl(216 18% 62%)",
  "--border": "hsl(218 34% 19%)",
  "--primary": "hsl(199 95% 55%)",
  "--primary-foreground": "hsl(222 47% 7%)",
  "--success": "hsl(152 62% 42%)",
  "--status-online": "hsl(152 62% 50%)",
  "--status-moving": "hsl(38 92% 55%)",
  "--prio-high": "hsl(25 95% 58%)",
  "--prio-medium": "hsl(199 90% 56%)",
  "--radius": "0.625rem",
  "--font-mono": '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
  "--glow-primary": "0 0 12px hsl(199 95% 55% / 0.35)",
  "--glow-primary-lg": "0 0 32px hsl(199 95% 55% / 0.18)",
  "--shadow-md": "0 4px 12px hsl(224 40% 2% / 0.45)",
  "--ease-out": "cubic-bezier(0.2, 0.6, 0.6, 1)",
} as CSSProperties;

const CSS = `
.menu-preview-canvas {
  background-color: hsl(224 30% 5%);
  background-image:
    linear-gradient(to right,  hsl(220 22% 14% / 0.5) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(220 22% 14% / 0.5) 1px, transparent 1px);
  background-size: 32px 32px;
}
.menu-card { transition: transform .22s var(--ease-out), border-color .22s var(--ease-out), box-shadow .22s var(--ease-out); will-change: transform; }
.menu-card:hover {
  transform: translateY(-3px);
  border-color: var(--hover-accent, color-mix(in srgb, var(--primary) 45%, transparent)) !important;
  box-shadow: 0 10px 26px -12px #000, 0 0 0 1px var(--hover-accent, color-mix(in srgb, var(--primary) 30%, transparent)),
              0 8px 24px -10px var(--hover-glow, hsl(199 95% 55% / 0.25)) !important;
}
.menu-card:active { transform: translateY(-1px) scale(0.985); }
.menu-icon { transition: transform .22s var(--ease-out); }
.menu-card:hover .menu-icon { transform: scale(1.06); }
.dp-scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
.dp-scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.dp-scrollbar-thin::-webkit-scrollbar-thumb { border-radius: 9999px; background: var(--border); }
@media (prefers-reduced-motion: no-preference) {
  .stagger > * { opacity: 0; animation: dp-fade-up .5s var(--ease-out) forwards; }
  .stagger > *:nth-child(1){animation-delay:.03s} .stagger > *:nth-child(2){animation-delay:.07s}
  .stagger > *:nth-child(3){animation-delay:.11s} .stagger > *:nth-child(4){animation-delay:.15s}
  .stagger > *:nth-child(5){animation-delay:.19s} .stagger > *:nth-child(6){animation-delay:.23s}
  .stagger > *:nth-child(7){animation-delay:.27s} .stagger > *:nth-child(8){animation-delay:.31s}
  .stagger > *:nth-child(9){animation-delay:.35s}
}
@keyframes dp-fade-up { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: none; } }
`;

export default function MenuPreviewPage() {
  return (
    <main
      className="menu-preview-canvas"
      style={{ ...PALETTE, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 16px" }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(216 18% 62%)" }}>
        B · ลอนช์เชอร์ 3 คอลัมน์
      </p>
      <div style={{
        width: 380, height: 760, maxWidth: "100%", borderRadius: 44, padding: 10, flexShrink: 0,
        background: "hsl(220 30% 8%)", border: "1px solid hsl(218 34% 19%)",
        boxShadow: "0 30px 80px -30px #000, inset 0 0 0 2px hsl(220 30% 12%)",
        position: "relative",
      }}>
        <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", width: 120, height: 26, borderRadius: 9999, background: "hsl(224 30% 4%)", zIndex: 2 }} />
        <div style={{ width: "100%", height: "100%", borderRadius: 36, overflow: "hidden", position: "relative", background: "hsl(222 47% 6%)" }}>
          <HomeLauncher />
        </div>
      </div>
    </main>
  );
}
