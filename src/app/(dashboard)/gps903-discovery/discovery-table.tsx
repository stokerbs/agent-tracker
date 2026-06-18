"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Search, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { ImportToCaseDialog } from "@/components/gps903/import-to-case-dialog";
import { RelinkAgentDialog } from "@/components/gps903/relink-agent-dialog";
import type { AgentOption, CaseOption, EnrichedDevice } from "./types";

const PROVIDER_CFG: Record<string, string> = {
  AIS:    "bg-green-500/10 text-green-400  border-green-500/20",
  TRUE:   "bg-red-500/10   text-red-400    border-red-500/20",
  DTAC:   "bg-blue-500/10  text-blue-400   border-blue-500/20",
  GPS903: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function ProviderBadge({ provider }: { provider: string }) {
  const cls = PROVIDER_CFG[provider] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${cls}`}>
      <Signal className="h-2.5 w-2.5" />
      {provider}
    </span>
  );
}

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  devices:      EnrichedDevice[];
  cases:        CaseOption[];
  agents:       AgentOption[];
  emptyMessage: string;
}

export function DiscoveryTable({ devices, cases, agents, emptyMessage }: Props) {
  const [search, setSearch] = useState("");

  const filtered = devices.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (d.gps903Id != null && String(d.gps903Id).includes(q)) ||
      d.deviceName.toLowerCase().includes(q) ||
      d.imei.toLowerCase().includes(q) ||
      (d.phoneNumber?.toLowerCase().includes(q)  ?? false) ||
      (d.provider?.toLowerCase().includes(q)     ?? false)
    );
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, IMEI, model, phone, provider…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Device</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const firstLink = d.linkedCases[0] ?? null;
                const isLinked  = d.linkedCases.length > 0;

                return (
                  <TableRow key={d.credentialId} className="text-sm">
                    {/* Device */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            isLinked ? "bg-emerald-500" : "bg-border"
                          }`}
                        />
                        <div>
                          {d.gps903Id != null && (
                            <p className="font-mono text-xs font-bold">GPS903-{d.gps903Id}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{d.deviceName}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* IMEI + SIM info */}
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-mono text-xs text-muted-foreground">{d.imei}</p>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="font-mono">{d.phoneNumber ?? "—"}</span>
                        </div>
                        {d.provider && <ProviderBadge provider={d.provider} />}
                      </div>
                    </TableCell>

                    {/* Last Synced (replaces Model + Last Seen columns) */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground/50">—</span>
                    </TableCell>

                    {/* Last Synced */}
                    <TableCell className="text-xs text-muted-foreground">
                      {timeAgo(d.lastSynced)}
                    </TableCell>

                    {/* Case */}
                    <TableCell className="text-xs">
                      {firstLink ? (
                        <span className="flex items-center gap-1">
                          <Link
                            href={`/cases/${firstLink.caseId}`}
                            className="font-mono font-medium text-primary hover:underline"
                          >
                            {firstLink.caseNumber}
                          </Link>
                          {d.linkedCases.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{d.linkedCases.length - 1}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Agent */}
                    <TableCell className="text-xs">
                      {firstLink?.agentName ? (
                        <span className="font-medium">{firstLink.agentName}</span>
                      ) : firstLink ? (
                        <span className="text-muted-foreground/50">Not linked</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {!isLinked ? (
                          <ImportToCaseDialog
                            credentialId={d.credentialId}
                            deviceName={d.deviceName}
                            cases={cases}
                            agents={agents}
                          />
                        ) : (
                          <>
                            {firstLink && (
                              <RelinkAgentDialog
                                deviceId={firstLink.gpsDeviceId}
                                currentAgentId={firstLink.agentId}
                                agents={agents}
                              />
                            )}
                            {firstLink && (
                              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                                <Link href={`/gps-devices/${firstLink.gpsDeviceId}`}>
                                  Manage
                                </Link>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
