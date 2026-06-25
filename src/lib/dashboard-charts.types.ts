// Dashboard chart view-models owned by the data layer.
// Consumed by both lib/queries.ts (which produces them) and the chart UI
// (src/components/dashboard/charts.tsx, which renders them). Kept separate
// from lib/types.ts (ARCH-3 territory) to avoid the data → UI layering inversion.

export interface CasesTrendPoint {
  month: string;   // "Jun"
  cases: number;
}

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

export interface AgentLoad {
  name: string;   // short name / nickname
  cases: number;
}

export interface RevenueTrendPoint {
  month: string;
  invoiced: number;
  paid: number;
}
