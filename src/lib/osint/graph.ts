/**
 * Build a relationship graph from an analysis result.
 *
 * Pure + deterministic so it can be unit-tested and rendered by Cytoscape on the
 * client. Nodes: the image at the centre, the domains in its redirect chain, the
 * CDN + cloud-storage providers fronting/hosting it, and the linked case.
 * Phase-2 face/object nodes attach here later with no shape change.
 */

import type { AnalysisResult } from "./types";

export type GraphNodeType = "image" | "domain" | "cdn" | "cloud" | "case" | "face" | "object";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraph(result: AnalysisResult): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (id: string, label: string, type: GraphNodeType) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, label, type });
  };
  const addEdge = (source: string, target: string, label?: string) => {
    const id = `${source}->${target}`;
    if (edges.some((e) => e.id === id)) return;
    edges.push({ id, source, target, label });
  };

  const imageId = "image";
  addNode(imageId, "Image", "image");

  // Domains from the redirect chain (deduped by host), in order.
  let prevDomainId: string | null = null;
  const domainIds = new Map<string, string>();
  for (const hop of result.redirects) {
    const host = hop.resolvedHost;
    if (!host) continue;
    const id = `domain:${host}`;
    if (!domainIds.has(host)) {
      domainIds.set(host, id);
      addNode(id, host, "domain");
      // Chain the domains so the redirect path is visible.
      if (prevDomainId) addEdge(prevDomainId, id, "redirect");
      prevDomainId = id;
    }
  }

  // Attribution host (final image host) — connect image → host.
  const finalHost = result.attribution?.host ?? null;
  const finalHostId = finalHost ? `domain:${finalHost}` : null;
  if (finalHost && finalHostId) {
    addNode(finalHostId, finalHost, "domain");
    addEdge(imageId, finalHostId, "hosted at");
  } else if (prevDomainId) {
    addEdge(imageId, prevDomainId, "hosted at");
  }

  // Cloud storage + CDN providers hang off the final host (or the image).
  const anchorId = finalHostId ?? prevDomainId ?? imageId;
  for (const c of result.attribution?.cloud ?? []) {
    const id = `cloud:${c.provider}`;
    addNode(id, c.provider, "cloud");
    addEdge(anchorId, id, "storage");
  }
  for (const c of result.attribution?.cdn ?? []) {
    const id = `cdn:${c.provider}`;
    addNode(id, c.provider, "cdn");
    addEdge(anchorId, id, "cdn");
  }

  // Linked case.
  if (result.caseId) {
    const id = `case:${result.caseId}`;
    addNode(id, "Case", "case");
    addEdge(imageId, id, "evidence in");
  }

  return { nodes, edges };
}
