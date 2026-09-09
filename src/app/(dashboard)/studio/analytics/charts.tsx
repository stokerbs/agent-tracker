"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Pillar, Platform } from "@/lib/studio/types";

export interface ChartPoint {
  key: string;
  label: string;
  views: number;
  leads: number;
}

const PILLAR_COLORS: Record<Pillar, string> = {
  detective_knowledge: "#0EA5E9",
  case_story: "#8B5CF6",
  detective_pov: "#10B981",
  red_flags: "#F59E0B",
  behind_investigation: "#64748B",
  service: "#d6a23f",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  tiktok: "#111827",
  instagram_reel: "#EC4899",
  instagram_post: "#F472B6",
  instagram_carousel: "#F9A8D4",
  facebook: "#3B82F6",
  youtube_short: "#EF4444",
  article: "#9CA3AF",
  line_oa: "#22C55E",
};

function compact(n: number): string {
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function BaseBarChart({ data, colorFor, height }: { data: ChartPoint[]; colorFor: (key: string) => string; height: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} />
        <YAxis allowDecimals={false} tickFormatter={compact} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
          formatter={(value, name) => [Number(value).toLocaleString("en-GB"), name === "views" ? "ยอดวิว" : "leads"]}
        />
        <Bar dataKey="views" name="views" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.key} fill={colorFor(d.key)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Views (latest snapshot per piece) grouped by content pillar. */
export function ViewsByPillarChart({ data }: { data: ChartPoint[] }) {
  return <BaseBarChart data={data} height={260} colorFor={(k) => PILLAR_COLORS[k as Pillar] ?? "#94A3B8"} />;
}

/** Views (latest snapshot per piece) grouped by platform. */
export function ViewsByPlatformChart({ data }: { data: ChartPoint[] }) {
  return <BaseBarChart data={data} height={220} colorFor={(k) => PLATFORM_COLORS[k as Platform] ?? "#94A3B8"} />;
}
