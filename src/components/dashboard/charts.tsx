"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";

// ─── Shared palette ────────────────────────────────────────────────────────

const C = {
  primary:     "#0EA5E9",
  success:     "#10B981",
  warning:     "#F59E0B",
  destructive: "#EF4444",
  violet:      "#8B5CF6",
  muted:       "#64748B",
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

// ─── Cases trend (bar) ─────────────────────────────────────────────────────

export interface CasesTrendPoint {
  month: string;   // "Jun"
  cases: number;
}

export function CasesTrendChart({ data }: { data: CasesTrendPoint[] }) {
  const t = useTranslations("dashboard.charts");
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: C.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: C.muted }}
          axisLine={false}
          tickLine={false}
          width={24}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "hsl(var(--accent))" }}
        />
        <Bar dataKey="cases" name={t("newCases")} fill={C.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Case status breakdown (donut) ─────────────────────────────────────────

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  active:   C.primary,
  assigned: C.violet,
  closed:   C.success,
  pending:  C.warning,
  archived: C.muted,
};

export function CaseStatusChart({ data }: { data: StatusSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.name] ?? C.muted} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [value, name]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Agent workload (horizontal bar) ────────────────────────────────────────

export interface AgentLoad {
  name: string;   // short name / nickname
  cases: number;
}

export function AgentWorkloadChart({ data }: { data: AgentLoad[] }) {
  const t = useTranslations("dashboard.charts");
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" barSize={14} margin={{ left: 0, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: C.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: C.muted }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "hsl(var(--accent))" }}
        />
        <Bar dataKey="cases" name={t("activeCases")} fill={C.success} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Revenue trend (area) ───────────────────────────────────────────────────

export interface RevenueTrendPoint {
  month: string;
  invoiced: number;
  paid: number;
}

export function RevenueTrendChart({ data }: { data: RevenueTrendPoint[] }) {
  const t = useTranslations("dashboard.charts");
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="gradInvoiced" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={C.primary} stopOpacity={0.2} />
            <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={C.success} stopOpacity={0.2} />
            <stop offset="95%" stopColor={C.success} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: C.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: C.muted }}
          axisLine={false}
          tickLine={false}
          width={40}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`฿${Number(value).toLocaleString()}`, undefined]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
        />
        <Area
          type="monotone"
          dataKey="invoiced"
          name={t("invoiced")}
          stroke={C.primary}
          strokeWidth={2}
          fill="url(#gradInvoiced)"
        />
        <Area
          type="monotone"
          dataKey="paid"
          name={t("paid")}
          stroke={C.success}
          strokeWidth={2}
          fill="url(#gradPaid)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
