"use client";

import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { Graph } from "@/lib/osint/graph";

// Detective/dark palette per node type.
const TYPE_COLOR: Record<string, string> = {
  image: "#38bdf8", // sky
  domain: "#a78bfa", // violet
  cdn: "#fb923c", // orange
  cloud: "#34d399", // emerald
  case: "#f472b6", // pink
  face: "#facc15",
  object: "#94a3b8",
};

/**
 * Renders the analysis relationship graph with Cytoscape. Mounted imperatively
 * via a ref (no React wrapper) so it stays compatible with React 19 and disposes
 * cleanly on unmount / data change.
 */
export function OsintGraph({ graph }: { graph: Graph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (graph.nodes.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graph.nodes.map((n) => ({ data: { id: n.id, label: n.label, type: n.type } })),
        ...graph.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: e.label ?? "" } })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: cytoscape.NodeSingular) => TYPE_COLOR[ele.data("type")] ?? "#94a3b8",
            label: "data(label)",
            color: "#e2e8f0",
            "font-size": 10,
            "text-valign": "bottom",
            "text-margin-y": 4,
            "text-wrap": "wrap",
            "text-max-width": "120px",
            width: 26,
            height: 26,
            "border-width": 2,
            "border-color": "#0f172a",
          },
        },
        {
          selector: 'node[type="image"]',
          style: { width: 40, height: 40, "font-size": 12 },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#334155",
            "target-arrow-color": "#334155",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 8,
            color: "#64748b",
            "text-background-color": "#0f172a",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
          },
        },
      ],
      layout: { name: "concentric", concentric: (n: cytoscape.NodeSingular) => (n.data("type") === "image" ? 10 : 1), levelWidth: () => 1, minNodeSpacing: 40 },
      minZoom: 0.3,
      maxZoom: 2.5,
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph]);

  return (
    <div
      ref={containerRef}
      className="h-[360px] w-full rounded-lg border border-border bg-[#0b1120]"
      role="img"
      aria-label="Relationship graph of the analyzed image, its domains, CDN, cloud storage and case"
    />
  );
}
