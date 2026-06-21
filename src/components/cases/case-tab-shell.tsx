"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { CaseBottomNav } from "./case-bottom-nav";
import { CaseFAB } from "./case-fab";

interface Props {
  defaultValue: string;
  counts: {
    timeline: number;
    evidence: number;
    messagesUnread: number;
  };
  staff: boolean;
  canInsert: boolean;
  children: React.ReactNode;
}

export function CaseTabShell({
  defaultValue,
  counts,
  staff,
  canInsert,
  children,
}: Props) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {children}
      <CaseBottomNav counts={counts} staff={staff} />
      <CaseFAB activeTab={activeTab} staff={staff} canInsert={canInsert} />
    </Tabs>
  );
}
